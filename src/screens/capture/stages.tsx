import { CircleAlert, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { cx } from '../../lib/format';
import type { PreparedImage } from '../../lib/image';
import { matchMeals, mealKey } from '../../lib/presets';
import type { MealPreset } from '../../lib/types';
import { MealRow, mealDetail } from './MealsStage';

export type CaptureMode = 'voice' | 'photo' | 'text';

interface Action {
  label: string;
  onClick: () => void;
}

export function ProblemStage({ title, message, primary, secondary }: { title: string; message: string; primary: Action; secondary?: Action }) {
  return (
    <div className="px-5 pb-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff3e3] text-[#c25e00]">
        <CircleAlert size={26} />
      </div>
      <p className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[320px] text-balance text-[15px] leading-snug text-ink-2">{message}</p>
      <div className="mt-6 space-y-1">
        <Button onClick={primary.onClick}>{primary.label}</Button>
        {secondary && (
          <Button variant="plain" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ComposeProps {
  initialText?: string;
  /** Favourite and recent meals, suggested when the description matches one. */
  meals: MealPreset[];
  onSubmit: (text: string) => void;
  onManual: () => void;
  onMeals: () => void;
  onOpenMeal: (meal: MealPreset) => void;
  onAddMeal: (meal: MealPreset) => void;
}

export function ComposeStage({ initialText = '', meals, onSubmit, onManual, onMeals, onOpenMeal, onAddMeal }: ComposeProps) {
  const id = useId();
  const [text, setText] = useState(initialText);
  const matches = useMemo(() => matchMeals(meals, text).slice(0, 3), [meals, text]);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (text.trim()) onSubmit(text.trim());
  };

  return (
    <form onSubmit={submit} className="px-5 pb-5" noValidate>
      <label
        htmlFor={id}
        className="block rounded-[18px] bg-fill-2 px-4 py-3 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] focus-within:outline-ink"
      >
        <span className="sr-only">What did you eat?</span>
        <textarea
          id={id}
          autoFocus
          rows={4}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="e.g. 2 rotis, a katori of dal and a spoon of ghee"
          className="block w-full resize-none bg-transparent text-[17px] leading-snug outline-none placeholder:text-ink-3"
        />
      </label>
      {matches.length > 0 && (
        <div className="mt-3">
          <p className="px-0.5 text-[13px] font-medium text-ink-2">Had this before? Add it without waiting for the AI.</p>
          <ul className="divide-y divide-hairline">
            {matches.map((meal) => (
              <MealRow
                key={mealKey(meal.title)}
                meal={meal}
                detail={mealDetail(meal)}
                added={false}
                onOpen={() => onOpenMeal(meal)}
                onAdd={() => onAddMeal(meal)}
              />
            ))}
          </ul>
        </div>
      )}
      <Button type="submit" className="mt-4" disabled={!text.trim()}>
        <Sparkles size={18} />
        Estimate calories
      </Button>
      {meals.length > 0 && (
        <button type="button" onClick={onMeals} className="mt-2 w-full py-2.5 text-[15px] font-medium text-ink-2">
          Pick a meal you’ve had before
        </button>
      )}
      <button type="button" onClick={onManual} className={cx('w-full py-2.5 text-[15px] font-medium text-ink-2', meals.length === 0 && 'mt-2')}>
        Know the numbers? Enter them yourself
      </button>
    </form>
  );
}

export function PhotoStage({
  image,
  onSubmit,
  onRetake,
}: {
  image: PreparedImage;
  onSubmit: (note: string | null) => void;
  onRetake: () => void;
}) {
  const id = useId();
  const [note, setNote] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note.trim() || null);
      }}
      className="px-5 pb-5"
      noValidate
    >
      <motion.img
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        src={image.url}
        alt="Your meal"
        className="aspect-[4/3] w-full rounded-[22px] bg-fill-2 object-cover"
      />
      <label
        htmlFor={id}
        className="mt-3 block rounded-[16px] bg-fill-2 px-4 pb-2.5 pt-2 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] focus-within:outline-ink"
      >
        <span className="text-[12px] font-medium text-ink-2">Add a detail (optional)</span>
        <input
          id={id}
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. 2 rotis in ghee, or half the pack"
          className="block w-full bg-transparent text-[17px] outline-none placeholder:text-ink-3"
        />
      </label>
      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
        <Button variant="secondary" onClick={onRetake}>
          Retake
        </Button>
        <Button type="submit">
          <Sparkles size={18} />
          Estimate calories
        </Button>
      </div>
    </form>
  );
}

const STEPS: Record<CaptureMode, string[]> = {
  voice: ['Listening back…', 'Picking out each food…', 'Estimating portions…', 'Adding up calories…'],
  photo: ['Looking at your plate…', 'Spotting each food…', 'Estimating portions…', 'Adding up calories…'],
  text: ['Reading your meal…', 'Estimating portions…', 'Adding up calories…'],
};

export function AnalyzingStage({ mode, image }: { mode: CaptureMode; image: PreparedImage | null }) {
  const steps = STEPS[mode];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1500);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="px-5 pb-6" aria-live="polite">
      {image && <img src={image.url} alt="" className="mb-5 h-44 w-full rounded-[22px] object-cover" />}
      <div className="flex items-center gap-2.5">
        <motion.span
          className="text-brand"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'linear' }}
        >
          <Sparkles size={20} />
        </motion.span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-[17px] font-semibold tracking-[-0.01em]"
          >
            {steps[step]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-5 space-y-3" aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="shimmer h-12 flex-1 rounded-[14px]" style={{ animationDelay: `${row * 120}ms` }} />
            <div className="shimmer h-12 w-16 rounded-[14px]" style={{ animationDelay: `${row * 120 + 60}ms` }} />
          </div>
        ))}
        <div className="shimmer h-20 rounded-[20px]" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  );
}
