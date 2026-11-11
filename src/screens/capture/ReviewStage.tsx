import { Clock, Globe, Info, Lightbulb, Minus, Plus, RotateCcw, ScanText, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useMealBook } from '../../app/mealBook';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button, IconButton } from '../../components/ui/Button';
import { DayField, SegmentedControl } from '../../components/ui/controls';
import { NumberRoll } from '../../components/ui/NumberRoll';
import { SHARES, type Share, fittingShare, mealImpact } from '../../lib/budget';
import { isLoggableDay } from '../../lib/dates';
import { cx, fmt1, fmtInt } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { PreparedImage } from '../../lib/image';
import { removeCheck, saveCheck } from '../../lib/later';
import { MEALS, mealForTime, mealLabel, sumNutrients } from '../../lib/meals';
import { spring } from '../../lib/motion';
import type { Plan } from '../../lib/nutrition';
import { portionQuantity, scaleItem, stepFor, unitLabel } from '../../lib/portions';
import type { AnalyzedItem, AnalyzeResult, DateKey, Entry, FoodItem, Meal, MealAnalysis, NewEntry, Nutrients } from '../../lib/types';
import { FavouriteStar } from './MealsStage';
import type { CaptureMode } from './stages';

/** A fresh estimate, one kept with "Decide later", or an entry that's already logged. */
export type ReviewTarget = { kind: 'new' } | { kind: 'saved'; id: string } | { kind: 'edit'; entry: Entry };

/** What's already logged on the day this meal would go to, and that day's targets. */
export interface DayBudget {
  eaten: Nutrients;
  plan: Plan;
}

interface Row {
  key: string;
  item: AnalyzedItem;
  quantity: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SHARE_OPTIONS = SHARES.map((s) => ({ value: String(s.value), label: s.label }));
const SHARE_HINT: Record<Exclude<Share, 1>, string> = { 0.75: '¾', 0.5: 'half' };

function Stepper({ row, onChange, onRemove }: { row: Row; onChange: (q: number) => void; onRemove: () => void }) {
  const step = stepFor(row.item);
  const atMin = row.quantity <= step;
  const control = 'flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors active:bg-fill';
  return (
    <div className="flex h-8 items-center rounded-full bg-fill-2">
      <button
        type="button"
        aria-label={atMin ? `Remove ${row.item.name}` : `Less ${row.item.name}`}
        onClick={() => (atMin ? onRemove() : onChange(round2(row.quantity - step)))}
        className={control}
      >
        {atMin ? <Trash size={14} /> : <Minus size={14} strokeWidth={2.5} />}
      </button>
      <span className="min-w-[60px] px-0.5 text-center text-[13px] font-semibold tabular-nums">
        {fmt1(row.quantity)} {unitLabel(row.item.unit, row.quantity)}
      </span>
      <button type="button" aria-label={`More ${row.item.name}`} onClick={() => onChange(round2(row.quantity + step))} className={control}>
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ItemRow({ row, scaled, index, onChange, onRemove }: { row: Row; scaled: FoodItem; index: number; onChange: (q: number) => void; onRemove: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { ...spring, delay: 0.05 + index * 0.06 } }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
      className="flex items-start gap-3 overflow-hidden py-3.5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold tracking-[-0.01em]">{row.item.name}</p>
        <p className="mt-0.5 text-[13px] tabular-nums text-ink-2">
          {scaled.grams ? `≈ ${fmtInt(scaled.grams)} g · ` : ''}P {scaled.protein} · C {scaled.carbs} · F {scaled.fat} g
        </p>
        {row.item.assumption && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-[#a65300]">
            <Info size={14} className="mt-[2px] shrink-0" />
            {row.item.assumption}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-[17px] font-semibold tabular-nums tracking-[-0.01em]">
          {fmtInt(scaled.kcal)}
          <span className="ml-0.5 text-[12px] font-medium text-ink-3">kcal</span>
        </p>
        <Stepper row={row} onChange={onChange} onRemove={onRemove} />
      </div>
    </motion.li>
  );
}

function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

/** Says when the numbers are a packaged product's published values rather than an estimate. */
function Basis({ analysis }: { analysis: MealAnalysis }) {
  if (analysis.basis !== 'label' && analysis.basis !== 'web') return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-ink">
      {analysis.basis === 'label' ? <ScanText size={14} className="shrink-0" /> : <Globe size={14} className="shrink-0" />}
      <span className="min-w-0 truncate">
        {analysis.basis === 'label' ? 'Numbers from the nutrition label' : 'Nutrition facts found online'}
        {analysis.basis === 'web' && analysis.sourceUrl && (
          <>
            {' · '}
            <a href={analysis.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              {siteName(analysis.sourceUrl)}
            </a>
          </>
        )}
      </span>
    </p>
  );
}

function Segment({ width, className }: { width: number; className: string }) {
  return <motion.div initial={false} animate={{ width: `${width * 100}%` }} transition={spring} className={cx('h-full shrink-0', className)} />;
}

/** "Should I eat this?": where the day ends up if this meal is eaten. */
function Impact({ budget, totals, fit, onShare }: { budget: DayBudget; totals: Nutrients; fit: Share | 'none' | null; onShare: (s: Share) => void }) {
  const { eaten, plan } = budget;
  const { after, bar } = mealImpact(eaten.kcal, totals.kcal, plan.calories);
  const over = after < 0;
  const proteinShare = plan.protein > 0 ? Math.round((totals.protein / plan.protein) * 100) : 0;

  return (
    <div className="mt-4 border-t border-white/12 pt-3.5">
      <p className={cx('text-[16px] font-semibold tracking-[-0.01em]', over && 'text-[#ffb340]')}>
        {over ? `${fmtInt(-after)} kcal over your target` : `${fmtInt(after)} kcal left after this`}
      </p>
      <div className="relative mt-2.5">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/12">
          <Segment width={bar.eaten} className="bg-white/40" />
          <Segment width={bar.within} className="bg-brand" />
          <Segment width={bar.over} className="bg-[#ff9f0a]" />
        </div>
        {bar.target < 1 && (
          <span className="absolute -top-[3px] h-3.5 w-[2px] rounded-full bg-white" style={{ left: `calc(${bar.target * 100}% - 1px)` }} />
        )}
      </div>
      <p className="mt-2 text-[13px] text-white/60">
        {fmtInt(eaten.kcal)} of {fmtInt(plan.calories)} kcal eaten so far
        {proteinShare > 0 && ` · ${proteinShare}% of your daily protein`}
      </p>
      {fit === 'none' && <p className="mt-1.5 text-[13px] font-medium text-[#ffb340]">Even half of it goes over your target.</p>}
      {fit != null && fit !== 'none' && fit !== 1 && (
        <button type="button" onClick={() => onShare(fit)} className="mt-1.5 text-left text-[13px] font-medium text-[#ffb340]">
          Having {SHARE_HINT[fit]} of it keeps you within your target. <span className="underline underline-offset-2">Use {SHARE_HINT[fit]}</span>
        </button>
      )}
    </div>
  );
}

function Totals({ totals, children }: { totals: Nutrients; children?: ReactNode }) {
  const macro = (label: string, value: number, color: string) => (
    <p className="flex items-center justify-end gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      <span className="text-white/60">{label}</span>
      <span className="w-10 text-right font-semibold">{fmtInt(value)} g</span>
    </p>
  );
  return (
    <div className="mt-4 rounded-[20px] bg-ink px-5 py-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-white/60">Total</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <NumberRoll value={totals.kcal} className="text-[34px] font-bold tracking-[-0.03em]" />
            <span className="text-[15px] text-white/70">kcal</span>
          </p>
        </div>
        <div className="space-y-1 text-[13px] tabular-nums">
          {macro('Protein', totals.protein, 'var(--color-protein)')}
          {macro('Carbs', totals.carbs, 'var(--color-carbs)')}
          {macro('Fat', totals.fat, '#8c8af0')}
        </div>
      </div>
      {children}
    </div>
  );
}

interface ReviewProps {
  result: AnalyzeResult;
  mode: CaptureMode;
  image: PreparedImage | null;
  photoNote: string | null;
  date: DateKey;
  target: ReviewTarget;
  budget: DayBudget;
  onDone: () => void;
  onReanalyze: (text: string) => void;
  onRetry: () => void;
  /** Replaces the default "Record again" / "Take another photo" / "Start over". */
  retryLabel?: string;
  onDelete: (entry: Entry) => void;
}

export function ReviewStage({
  result,
  mode,
  image,
  photoNote,
  date,
  target,
  budget,
  onDone,
  onReanalyze,
  onRetry,
  retryLabel,
  onDelete,
}: ReviewProps) {
  const { backend, user } = useSession();
  const book = useMealBook();
  const toast = useToast();
  const { analysis, usage } = result;
  const editing = target.kind === 'edit' ? target.entry : null;
  const [title, setTitle] = useState(analysis.title);
  const [rows, setRows] = useState<Row[]>(() => analysis.items.map((item, i) => ({ key: `${i}-${item.name}`, item, quantity: item.quantity })));
  const [meal, setMeal] = useState<Meal>(() => editing?.meal ?? mealForTime());
  const [day, setDay] = useState<DateKey>(editing?.date ?? date);
  const [draft, setDraft] = useState(result.transcript ?? '');

  const scaled = rows.map((r) => scaleItem(r.item, r.quantity));
  const totals = sumNutrients(scaled);
  const edited = result.transcript != null && draft.trim() !== '' && draft.trim() !== result.transcript.trim();
  const remaining = usage ? usage.limit - usage.used : null;

  const kcalAt = (share: Share) => rows.reduce((sum, r) => sum + scaleItem(r.item, portionQuantity(r.item, share)).kcal, 0);
  const share = SHARES.find((s) => rows.every((r) => r.quantity === portionQuantity(r.item, s.value)))?.value ?? null;
  const left = budget.plan.calories - budget.eaten.kcal;
  const fit = totals.kcal > left ? fittingShare(left, kcalAt) : null;
  const applyShare = (s: Share) => setRows((rs) => rs.map((r) => ({ ...r, quantity: portionQuantity(r.item, s) })));

  const finalTitle = title.trim() || analysis.title;
  const notes = mode === 'photo' ? photoNote : draft.trim() || null;
  const starred = book.isFavourite(finalTitle);

  function save() {
    const entry: NewEntry = {
      date: editing ? (isLoggableDay(day) ? day : editing.date) : date,
      meal,
      title: finalTitle,
      source: mode,
      items: scaled,
      totals,
      transcript: notes,
      loggedAt: editing?.loggedAt ?? Date.now(),
    };
    if (editing) {
      backend.data.updateEntry(user.uid, editing.id, entry).catch(() => toast({ message: 'Couldn’t save your changes. Try again.' }));
      haptic([8, 40, 8]);
      toast({ message: `Updated ${finalTitle}` });
    } else {
      backend.data.addEntry(user.uid, entry).catch(() => toast({ message: 'Couldn’t save that. Check your connection.' }));
      if (target.kind === 'saved') removeCheck(user.uid, target.id);
      haptic([10, 50, 10]);
      toast({ message: `Added ${fmtInt(totals.kcal)} kcal to ${mealLabel(meal)}` });
    }
    onDone();
  }

  function later() {
    saveCheck(user.uid, {
      id: target.kind === 'saved' ? target.id : crypto.randomUUID(),
      source: mode,
      transcript: notes,
      analysis: {
        ...analysis,
        title: finalTitle,
        items: rows.map((r) => ({ ...r.item, ...scaleItem(r.item, r.quantity), quantity: r.quantity, unit: r.item.unit })),
      },
    });
    haptic(10);
    toast({ message: 'Saved for later — log it from Today when you’ve eaten' });
    onDone();
  }

  function skip() {
    if (target.kind === 'saved') removeCheck(user.uid, target.id);
    toast({ message: `Skipped · ${fmtInt(totals.kcal)} kcal not logged` });
    onDone();
  }

  return (
    <div className="px-5 pb-5">
      {image ? (
        <img src={image.url} alt="" className="h-36 w-full rounded-[20px] object-cover" />
      ) : (
        result.transcript != null && (
          <div className="rounded-[18px] bg-fill-2 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">
              {mode === 'voice' ? 'You said' : 'You wrote'}
            </p>
            <textarea
              aria-label={mode === 'voice' ? 'What you said' : 'What you wrote'}
              value={draft}
              maxLength={1000}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-1 block w-full resize-none bg-transparent text-[16px] leading-snug outline-none field-sizing-content"
            />
            <AnimatePresence initial={false}>
              {edited && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Button size="sm" className="mt-2.5" onClick={() => onReanalyze(draft.trim())}>
                    <RotateCcw size={14} />
                    Update estimate
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      )}

      {analysis.items.length === 0 ? (
        <p className="mt-5 text-center text-[15px] leading-snug text-ink-2">
          {analysis.note ?? 'I couldn’t find any food in that. Try describing it differently.'}
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2">
            <input
              aria-label="Meal name"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-md bg-transparent text-[22px] font-semibold tracking-[-0.02em] outline-none focus-visible:bg-fill-2"
            />
            <IconButton
              label={starred ? 'Remove from favourites' : 'Save to favourites'}
              aria-pressed={starred}
              tone="plain"
              className="-mr-2"
              disabled={rows.length === 0}
              onClick={() => book.toggleFavourite({ title: finalTitle, items: scaled, totals, source: mode, meal })}
            >
              <FavouriteStar on={starred} size={22} />
            </IconButton>
          </div>
          <Basis analysis={analysis} />
          <ul className="mt-1 divide-y divide-hairline">
            <AnimatePresence initial={false}>
              {rows.map((row, i) => (
                <ItemRow
                  key={row.key}
                  row={row}
                  scaled={scaled[i]}
                  index={i}
                  onChange={(quantity) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, quantity } : r)))}
                  onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                />
              ))}
            </AnimatePresence>
          </ul>

          {rows.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="text-[15px] font-medium text-ink-2">How much?</p>
              <div className="w-[180px]">
                <SegmentedControl
                  label="Portion"
                  options={SHARE_OPTIONS}
                  value={share == null ? null : String(share)}
                  onChange={(v) => applyShare(Number(v) as Share)}
                />
              </div>
            </div>
          )}

          <Totals totals={totals}>
            {!editing && rows.length > 0 && <Impact budget={budget} totals={totals} fit={fit} onShare={applyShare} />}
          </Totals>
          {/* The tip is about the estimate as given; once amounts change it may no longer apply. */}
          {analysis.tip && share === 1 && rows.length === analysis.items.length && (
            <p className="mt-3 flex items-start gap-2 rounded-[16px] bg-brand/10 px-4 py-3 text-[14px] leading-snug text-brand-ink">
              <Lightbulb size={16} className="mt-[2px] shrink-0" />
              <span>
                <span className="font-semibold">Lighter: </span>
                {analysis.tip}
              </span>
            </p>
          )}
          {analysis.confidence === 'low' && (
            <p className="mt-3 px-1 text-[13px] leading-snug text-ink-2">This one’s a rough guess — adjust the amounts if you know them.</p>
          )}
          {analysis.note && <p className="mt-3 px-1 text-[13px] leading-snug text-ink-2">{analysis.note}</p>}

          <div className="mt-5">
            <SegmentedControl label="Meal" options={MEALS} value={meal} onChange={setMeal} />
          </div>
          {editing ? (
            <>
              <div className="mt-3">
                <DayField value={day} onChange={setDay} />
              </div>
              <Button className="mt-4" onClick={save} disabled={rows.length === 0}>
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button className="mt-4" onClick={save} disabled={rows.length === 0}>
                Add to {mealLabel(meal)}
              </Button>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Button variant="secondary" size="md" className="w-full" onClick={later} disabled={rows.length === 0}>
                  <Clock size={16} />
                  Decide later
                </Button>
                <Button variant="secondary" size="md" className="w-full" onClick={skip}>
                  Skip it
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {editing ? (
        <Button variant="danger" className="mt-1" onClick={() => onDelete(editing)}>
          Delete
        </Button>
      ) : (
        <button type="button" onClick={onRetry} className="mt-1 w-full py-2.5 text-[15px] font-medium text-ink-2">
          {retryLabel ?? (mode === 'voice' ? 'Record again' : mode === 'photo' ? 'Take another photo' : 'Start over')}
        </button>
      )}
      {remaining != null && remaining <= 5 && (
        <p className="text-center text-[12px] text-ink-3">
          {remaining} AI {remaining === 1 ? 'log' : 'logs'} left today
        </p>
      )}
    </div>
  );
}
