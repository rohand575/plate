import { Info, Minus, Plus, RotateCcw, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/controls';
import { NumberRoll } from '../../components/ui/NumberRoll';
import { fmt1, fmtInt } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { PreparedImage } from '../../lib/image';
import { MEALS, mealForTime, mealLabel, sumNutrients } from '../../lib/meals';
import { spring } from '../../lib/motion';
import { scaleItem, stepFor, unitLabel } from '../../lib/portions';
import type { AnalyzedItem, AnalyzeResult, DateKey, FoodItem, Meal, Nutrients } from '../../lib/types';
import type { CaptureMode } from './stages';

interface Row {
  key: string;
  item: AnalyzedItem;
  quantity: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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

function Totals({ totals }: { totals: Nutrients }) {
  const macro = (label: string, value: number, color: string) => (
    <p className="flex items-center justify-end gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      <span className="text-white/60">{label}</span>
      <span className="w-10 text-right font-semibold">{fmtInt(value)} g</span>
    </p>
  );
  return (
    <div className="mt-4 flex items-center justify-between rounded-[20px] bg-ink px-5 py-4 text-white">
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
  );
}

interface ReviewProps {
  result: AnalyzeResult;
  mode: CaptureMode;
  image: PreparedImage | null;
  photoNote: string | null;
  date: DateKey;
  onSaved: () => void;
  onReanalyze: (text: string) => void;
  onRetry: () => void;
}

export function ReviewStage({ result, mode, image, photoNote, date, onSaved, onReanalyze, onRetry }: ReviewProps) {
  const { backend, user } = useSession();
  const toast = useToast();
  const { analysis, usage } = result;
  const [title, setTitle] = useState(analysis.title);
  const [rows, setRows] = useState<Row[]>(() => analysis.items.map((item, i) => ({ key: `${i}-${item.name}`, item, quantity: item.quantity })));
  const [meal, setMeal] = useState<Meal>(() => mealForTime());
  const [draft, setDraft] = useState(result.transcript ?? '');

  const scaled = rows.map((r) => scaleItem(r.item, r.quantity));
  const totals = sumNutrients(scaled);
  const edited = result.transcript != null && draft.trim() !== '' && draft.trim() !== result.transcript.trim();
  const remaining = usage ? usage.limit - usage.used : null;

  function save() {
    backend.data
      .addEntry(user.uid, {
        date,
        meal,
        title: title.trim() || analysis.title,
        source: mode,
        items: scaled,
        totals,
        transcript: mode === 'photo' ? photoNote : draft.trim() || null,
        loggedAt: Date.now(),
      })
      .catch(() => toast({ message: 'Couldn’t save that. Check your connection.' }));
    haptic([10, 50, 10]);
    toast({ message: `Added ${fmtInt(totals.kcal)} kcal to ${mealLabel(meal)}` });
    onSaved();
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
          <input
            aria-label="Meal name"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-4 w-full rounded-md bg-transparent text-[22px] font-semibold tracking-[-0.02em] outline-none focus-visible:bg-fill-2"
          />
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

          <Totals totals={totals} />
          {analysis.confidence === 'low' && (
            <p className="mt-3 px-1 text-[13px] leading-snug text-ink-2">This one’s a rough guess — adjust the amounts if you know them.</p>
          )}
          {analysis.note && <p className="mt-3 px-1 text-[13px] leading-snug text-ink-2">{analysis.note}</p>}

          <div className="mt-5">
            <SegmentedControl label="Meal" options={MEALS} value={meal} onChange={setMeal} />
          </div>
          <Button className="mt-4" onClick={save} disabled={rows.length === 0}>
            Add to {mealLabel(meal)}
          </Button>
        </>
      )}

      <button type="button" onClick={onRetry} className="mt-1 w-full py-2.5 text-[15px] font-medium text-ink-2">
        {mode === 'voice' ? 'Record again' : mode === 'photo' ? 'Take another photo' : 'Start over'}
      </button>
      {remaining != null && remaining <= 5 && (
        <p className="text-center text-[12px] text-ink-3">
          {remaining} AI {remaining === 1 ? 'log' : 'logs'} left today
        </p>
      )}
    </div>
  );
}
