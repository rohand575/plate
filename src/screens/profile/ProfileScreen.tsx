import { ChevronLeft, ChevronRight, CookingPot, Download, LogOut, Pencil, Scale } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { type ReactNode, useMemo, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/ui/brand';
import { Card } from '../../components/ui/controls';
import { Overlay } from '../../components/ui/Overlay';
import { isDemo } from '../../data';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { todayKey } from '../../lib/dates';
import { cx, fmt1, fmtInt } from '../../lib/format';
import { kitchenSummary } from '../../lib/kitchen';
import { PACE_OPTIONS, SEX_OPTIONS, computePlan } from '../../lib/nutrition';
import type { Profile } from '../../lib/types';
import { Onboarding } from '../onboarding/Onboarding';
import { KitchenSheet } from './KitchenSheet';
import { LogWeightSheet } from './LogWeightSheet';
import { TargetSheet } from './TargetSheet';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">{title}</h2>
      <Card className="overflow-hidden">
        <div className="divide-y divide-hairline">{children}</div>
      </Card>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 px-4 py-3">
      <span className="text-[16px]">{label}</span>
      <span className="text-right text-[16px] tabular-nums text-ink-2">{value}</span>
    </div>
  );
}

/** A value row that opens an editor. */
function EditRow({ label, detail, value, onClick }: { label: string; detail: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-fill-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px]">{label}</span>
        <span className="block text-[13px] text-ink-2">{detail}</span>
      </span>
      <span className="text-right text-[16px] font-semibold tabular-nums text-ink">{value}</span>
      <ChevronRight size={18} className="-mr-1 shrink-0 text-ink-3" />
    </button>
  );
}

function ActionRow({ label, icon, onClick, danger }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[16px] font-medium transition-colors active:bg-fill-2',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className={cx('flex size-7 items-center justify-center rounded-[8px]', danger ? 'bg-danger/10' : 'bg-fill-2')}>{icon}</span>
      <span className="flex-1">{label}</span>
      {!danger && <ChevronRight size={18} className="text-ink-3" />}
    </button>
  );
}

export function ProfileScreen({ onClose }: { onClose: () => void }) {
  const { backend, user, profile } = useSession();
  const toast = useToast();
  const install = useInstallPrompt();
  const [editing, setEditing] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const plan = useMemo(() => computePlan(profile), [profile]);
  const pace = PACE_OPTIONS.find((o) => o.value === profile.pace)!;

  function saveEdit(edited: Profile) {
    // The plan editor doesn't know about the kitchen settings or a target of their own; keep them.
    const next: Profile = { ...edited };
    if (profile.kitchen) next.kitchen = profile.kitchen;
    if (profile.customCalories != null) next.customCalories = profile.customCalories;
    backend.data
      .saveProfile(user, next, { today: todayKey(), logWeight: next.weightKg !== profile.weightKg })
      .catch(() => toast({ message: 'Couldn’t save your plan. Try again.' }));
    setEditing(false);
    const kcal = fmtInt(computePlan(next).calories);
    toast({
      message: next.customCalories != null ? `Plan updated · your own ${kcal} kcal target still applies` : `Plan updated · ${kcal} kcal a day`,
    });
  }

  return (
    <Overlay onClose={onClose}>
      <div className="mx-auto w-full max-w-[600px] px-4 pb-[max(env(safe-area-inset-bottom),32px)] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1.5 flex items-center gap-0.5 rounded-full py-2 pr-3 text-[17px] font-medium"
          >
            <ChevronLeft size={24} />
            Today
          </button>
        </div>

        <div className="flex flex-col items-center pt-2 text-center">
          <Avatar name={user.displayName} photoURL={user.photoURL} size={76} />
          <h1 className="mt-3 text-[26px] font-bold tracking-[-0.025em]">{user.displayName ?? 'You'}</h1>
          {user.email && <p className="text-[15px] text-ink-2">{user.email}</p>}
        </div>

        <Group title="Your plan">
          <EditRow
            label="Daily target"
            detail={plan.isCustom ? `Set by you · calculated ${fmtInt(plan.calculatedCalories)}` : 'Calculated for you'}
            value={`${fmtInt(plan.calories)} kcal`}
            onClick={() => setTargetOpen(true)}
          />
          <Row label="Maintenance" value={`${fmtInt(plan.maintenance)} kcal`} />
          <Row label="Goal" value={pace.kgPerWeek > 0 ? `Lose ${pace.detail}` : 'Maintain weight'} />
          <Row label="Activity" value={plan.activityLabel} />
          <Row label="Protein · Carbs · Fat" value={`${plan.protein} · ${plan.carbs} · ${plan.fat} g`} />
          <ActionRow label="Edit plan" icon={<Pencil size={15} />} onClick={() => setEditing(true)} />
        </Group>
        {plan.limitNote && <p className="mt-2 px-4 text-[13px] leading-snug text-ink-2">{plan.limitNote}</p>}

        <Group title="Body">
          <Row label="Age" value={String(plan.age)} />
          <Row label="Sex" value={SEX_OPTIONS.find((o) => o.value === profile.sex)!.label} />
          <Row label="Height" value={`${fmt1(profile.heightCm)} cm`} />
          <Row label="Weight" value={`${fmt1(profile.weightKg)} kg`} />
          {profile.goalWeightKg != null && <Row label="Goal weight" value={`${fmt1(profile.goalWeightKg)} kg`} />}
          <Row label="BMI" value={fmt1(plan.bmi)} />
          <ActionRow label="Log today’s weight" icon={<Scale size={15} />} onClick={() => setWeightOpen(true)} />
        </Group>

        <Group title="Kitchen">
          <ActionRow label="Portions and cooking" icon={<CookingPot size={15} />} onClick={() => setKitchenOpen(true)} />
        </Group>
        <p className="mt-2 px-4 text-[13px] leading-snug text-ink-2">
          {profile.kitchen
            ? kitchenSummary(profile.kitchen)
            : 'Tell Plate your roti and katori sizes and how much oil you use, for closer estimates.'}
        </p>

        <Group title="App">
          {install.available && <ActionRow label="Install Plate" icon={<Download size={15} />} onClick={install.install} />}
          <ActionRow label="Sign out" icon={<LogOut size={15} />} danger onClick={() => void backend.auth.signOut()} />
        </Group>

        <p className="mt-6 px-4 text-center text-[12px] leading-relaxed text-ink-3">
          Targets use the Mifflin-St Jeor equation and are estimates, not medical advice.
          {isDemo && ' Demo mode — your data stays in this browser.'}
        </p>
      </div>

      <LogWeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
      <KitchenSheet open={kitchenOpen} onClose={() => setKitchenOpen(false)} />
      <TargetSheet open={targetOpen} onClose={() => setTargetOpen(false)} />
      <AnimatePresence>
        {editing && (
          <Overlay key="edit" from="bottom" onClose={() => setEditing(false)}>
            <Onboarding user={user} initial={profile} onSave={saveEdit} onCancel={() => setEditing(false)} />
          </Overlay>
        )}
      </AnimatePresence>
    </Overlay>
  );
}
