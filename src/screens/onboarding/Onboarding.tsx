import { ChevronLeft, Footprints, HardHat, Laptop, PersonStanding, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { NumberField, OptionCard, SegmentedControl } from '../../components/ui/controls';
import { ageOn, yearsAgo } from '../../lib/dates';
import { cx, fmtInt, parseNumber } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { iosEase } from '../../lib/motion';
import {
  ADULT_AGE,
  MIN_AGE,
  PACE_OPTIONS,
  RECOMMENDED_PACE,
  SEX_OPTIONS,
  WALKING_OPTIONS,
  WORK_OPTIONS,
  WORKOUT_OPTIONS,
  computePlan,
} from '../../lib/nutrition';
import type { AppUser, Pace, Profile, Sex, Walking, Workouts, WorkType } from '../../lib/types';
import { ChipGroup, DateField, FieldLabel, Hint, StepHeader } from './fields';
import { PlanReveal } from './PlanReveal';

type StepId = 'about' | 'body' | 'day' | 'movement' | 'goal' | 'reveal';
const STEPS: StepId[] = ['about', 'body', 'day', 'movement', 'goal', 'reveal'];
const INPUT_STEPS = STEPS.length - 1;

const HEIGHT_RANGE = [120, 230] as const;
const WEIGHT_RANGE = [30, 300] as const;
const MAX_AGE = 100;

const WORK_ICONS: Record<WorkType, ReactNode> = {
  sitting: <Laptop size={20} />,
  mixed: <Footprints size={20} />,
  standing: <PersonStanding size={20} />,
  physical: <HardHat size={20} />,
};

interface Draft {
  birthDate: string;
  sex: Sex | null;
  height: string;
  weight: string;
  goal: string;
  work: WorkType | null;
  workouts: Workouts | null;
  walking: Walking | null;
  pace: Pace | null;
}

function draftFrom(p?: Profile): Draft {
  if (!p) {
    return { birthDate: '', sex: null, height: '', weight: '', goal: '', work: null, workouts: null, walking: null, pace: RECOMMENDED_PACE };
  }
  return {
    birthDate: p.birthDate,
    sex: p.sex,
    height: String(p.heightCm),
    weight: String(p.weightKg),
    goal: p.goalWeightKg != null ? String(p.goalWeightKg) : '',
    work: p.work,
    workouts: p.workouts,
    walking: p.walking,
    pace: p.pace,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function rangeError(raw: string, [min, max]: readonly [number, number], unit: string): string | null {
  if (raw.trim() === '') return null;
  const n = parseNumber(raw);
  return n == null || n < min || n > max ? `Enter a value between ${min} and ${max} ${unit}` : null;
}

function toProfile(d: Draft): Profile | null {
  const heightCm = parseNumber(d.height);
  const weightKg = parseNumber(d.weight);
  const goal = parseNumber(d.goal);
  if (!d.birthDate || !d.sex || heightCm == null || weightKg == null || !d.work || !d.workouts || !d.walking || !d.pace) {
    return null;
  }
  return {
    birthDate: d.birthDate,
    sex: d.sex,
    heightCm: round1(heightCm),
    weightKg: round1(weightKg),
    goalWeightKg: goal != null ? round1(goal) : null,
    work: d.work,
    workouts: d.workouts,
    walking: d.walking,
    pace: d.pace,
  };
}

const isLossPace = (pace: Pace | null) => (PACE_OPTIONS.find((o) => o.value === pace)?.kgPerWeek ?? 0) > 0;

interface OnboardingProps {
  user: AppUser;
  /** Present when editing an existing plan. */
  initial?: Profile;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
  onSignOut?: () => void;
}

export function Onboarding({ user, initial, onSave, onCancel, onSignOut }: OnboardingProps) {
  const editing = initial != null;
  const now = useMemo(() => new Date(), []);
  const topRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [[index, direction], setStep] = useState<[number, number]>([0, 1]);
  const step = STEPS[index];

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const age = draft.birthDate ? ageOn(draft.birthDate, now) : null;
  const minor = age != null && age < ADULT_AGE;
  const ageError = age != null && (age < MIN_AGE || age > MAX_AGE) ? `Plate is for people aged ${MIN_AGE} and over.` : null;
  const heightError = rangeError(draft.height, HEIGHT_RANGE, 'cm');
  const weightError = rangeError(draft.weight, WEIGHT_RANGE, 'kg');
  const goalError = rangeError(draft.goal, WEIGHT_RANGE, 'kg');
  const profile = toProfile(draft);

  const valid: Record<StepId, boolean> = {
    about: age != null && !ageError && draft.sex != null,
    body: draft.height !== '' && draft.weight !== '' && !heightError && !weightError && !goalError,
    day: draft.work != null,
    movement: draft.workouts != null && draft.walking != null,
    goal: draft.pace != null && !(minor && isLossPace(draft.pace)),
    reveal: profile != null,
  };

  function go(to: number) {
    setStep([to, to > index ? 1 : -1]);
    topRef.current?.scrollIntoView({ block: 'start' });
  }

  function next(e?: FormEvent) {
    e?.preventDefault();
    if (!valid[step]) return;
    haptic();
    if (step === 'reveal') return onSave(profile!);
    if (STEPS[index + 1] === 'goal' && minor && isLossPace(draft.pace)) set('pace', 'maintain');
    go(index + 1);
  }

  const firstName = user.displayName?.split(' ')[0];
  const cta = step === 'goal' ? 'See my plan' : step === 'reveal' ? (editing ? 'Save plan' : 'Start tracking') : 'Continue';

  let content: ReactNode;
  switch (step) {
    case 'about':
      content = (
        <>
          <StepHeader
            title={editing ? 'About you' : `Hi${firstName ? ` ${firstName}` : ''}. Let’s set up your plan.`}
            subtitle="A few quick questions so Plate can work out the right daily calories for you."
          />
          <DateField
            label="Date of birth"
            value={draft.birthDate}
            onChange={(v) => set('birthDate', v)}
            min={yearsAgo(MAX_AGE, now)}
            max={yearsAgo(MIN_AGE, now)}
            error={ageError}
            trailing={age != null && !ageError && <span className="text-[15px] tabular-nums text-ink-2">{age} yrs</span>}
          />
          <FieldLabel className="mt-7">Sex</FieldLabel>
          <ChipGroup label="Sex" options={SEX_OPTIONS} value={draft.sex} onChange={(v) => set('sex', v)} />
          <Hint>Only used in the metabolism formula.</Hint>
        </>
      );
      break;
    case 'body':
      content = (
        <>
          <StepHeader title="Your body" subtitle="Used to estimate how much energy you burn in a day." />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Height" unit="cm" value={draft.height} onChange={(v) => set('height', v)} placeholder="175" error={heightError} />
            <NumberField label="Weight" unit="kg" value={draft.weight} onChange={(v) => set('weight', v)} placeholder="70" error={weightError} />
          </div>
          <div className="mt-3">
            <NumberField
              label="Goal weight (optional)"
              unit="kg"
              value={draft.goal}
              onChange={(v) => set('goal', v)}
              placeholder="—"
              error={goalError}
              hint="Lets Plate show when you’re likely to get there."
            />
          </div>
        </>
      );
      break;
    case 'day':
      content = (
        <>
          <StepHeader title="What’s a typical day like?" subtitle="Think about your job or main daily activity." />
          <div role="radiogroup" aria-label="Typical day" className="space-y-2.5">
            {WORK_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={draft.work === o.value}
                onSelect={() => set('work', o.value)}
                title={o.label}
                detail={o.detail}
                icon={WORK_ICONS[o.value]}
              />
            ))}
          </div>
        </>
      );
      break;
    case 'movement':
      content = (
        <>
          <StepHeader title="How much do you move?" subtitle="Rough answers are fine — Plate fine-tunes this as you log." />
          <FieldLabel>Workouts per week</FieldLabel>
          <SegmentedControl label="Workouts per week" options={WORKOUT_OPTIONS} value={draft.workouts} onChange={(v) => set('workouts', v)} />
          <Hint>Gym, sport, running, yoga — anything that gets your heart rate up.</Hint>
          <FieldLabel className="mt-7">Everyday walking</FieldLabel>
          <div role="radiogroup" aria-label="Everyday walking" className="space-y-2.5">
            {WALKING_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                selected={draft.walking === o.value}
                onSelect={() => set('walking', o.value)}
                title={o.label}
                detail={o.detail}
              />
            ))}
          </div>
        </>
      );
      break;
    case 'goal': {
      const selectedPlan = profile ? computePlan(profile, now) : null;
      content = (
        <>
          <StepHeader title="What’s your goal?" subtitle="You can change this any time." />
          <div role="radiogroup" aria-label="Goal" className="space-y-2.5">
            {PACE_OPTIONS.map((o) => {
              const kcal = profile ? computePlan({ ...profile, pace: o.value }, now).calories : null;
              const blocked = minor && o.kgPerWeek > 0;
              return (
                <OptionCard
                  key={o.value}
                  selected={draft.pace === o.value}
                  onSelect={() => set('pace', o.value)}
                  title={o.label}
                  detail={o.detail}
                  badge={o.value === RECOMMENDED_PACE && !minor ? 'Recommended' : undefined}
                  disabled={blocked}
                  trailing={
                    kcal != null && (
                      <span className="shrink-0 text-right">
                        <span className="block text-[17px] font-semibold tabular-nums tracking-[-0.01em]">{fmtInt(kcal)}</span>
                        <span className="block text-[12px] text-ink-2">kcal/day</span>
                      </span>
                    )
                  }
                />
              );
            })}
          </div>
          {minor && <Hint>Weight-loss targets are for adults, so Plate will help you maintain.</Hint>}
          {!minor && selectedPlan?.limitNote && <Hint>{selectedPlan.limitNote}</Hint>}
        </>
      );
      break;
    }
    case 'reveal':
      content = profile && <PlanReveal profile={profile} plan={computePlan(profile, now)} />;
      break;
  }

  return (
    <div ref={topRef} className="min-h-dvh bg-canvas pt-[env(safe-area-inset-top)]">
      <form onSubmit={next} className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5" noValidate>
        <header className="flex h-14 shrink-0 items-center gap-3">
          {index > 0 ? (
            <IconButton label="Back" tone="plain" className="-ml-2" onClick={() => go(index - 1)}>
              <ChevronLeft size={24} />
            </IconButton>
          ) : editing ? (
            <IconButton label="Close" tone="plain" className="-ml-2" onClick={onCancel}>
              <X size={22} />
            </IconButton>
          ) : null}
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {Array.from({ length: INPUT_STEPS }, (_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-fill">
                <motion.div
                  className="h-full rounded-full bg-ink"
                  initial={false}
                  animate={{ width: i <= index ? '100%' : '0%' }}
                  transition={{ duration: 0.45, ease: iosEase }}
                />
              </div>
            ))}
          </div>
          {!editing && index === 0 && onSignOut && (
            <button type="button" onClick={onSignOut} className="text-[15px] font-medium text-ink-2">
              Sign out
            </button>
          )}
        </header>

        <main className="relative flex-1 pt-5">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 36 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -36 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: iosEase }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer
          className={cx(
            'sticky bottom-0 -mx-5 mt-8 bg-linear-to-t from-canvas from-70% to-transparent px-5 pt-6',
            'pb-[max(env(safe-area-inset-bottom),20px)]',
          )}
        >
          <Button type="submit" disabled={!valid[step]}>
            {cta}
          </Button>
        </footer>
      </form>
    </div>
  );
}
