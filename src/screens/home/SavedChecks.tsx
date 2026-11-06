import { Clock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Card } from '../../components/ui/controls';
import { timeLabel } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import type { SavedCheck } from '../../lib/later';
import { sumNutrients } from '../../lib/meals';
import { spring } from '../../lib/motion';

/** Meals checked with "Decide later", waiting to be logged or dismissed. */
export function SavedChecks({
  checks,
  onOpen,
  onDismiss,
}: {
  checks: SavedCheck[];
  onOpen: (check: SavedCheck) => void;
  onDismiss: (check: SavedCheck) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {checks.length > 0 && (
        <motion.section
          key="later"
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={spring}
        >
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Saved for later</h2>
            <span className="text-[13px] text-ink-2">Tap to log</span>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              <AnimatePresence initial={false}>
                {checks.map((check) => (
                  <motion.li
                    key={check.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring}
                    className="flex items-center overflow-hidden pr-2"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(check)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left transition-colors active:bg-fill-2/60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff3e3] text-[#c25e00]">
                        <Clock size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium tracking-[-0.01em]">{check.analysis.title}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-ink-2">Checked at {timeLabel(check.savedAt)}</span>
                      </span>
                      <span className="shrink-0 pr-1 text-right">
                        <span className="block text-[16px] font-semibold tabular-nums tracking-[-0.01em]">
                          {fmtInt(sumNutrients(check.analysis.items).kcal)}
                        </span>
                        <span className="block text-[12px] text-ink-3">kcal</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(check)}
                      aria-label={`Dismiss ${check.analysis.title}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-fill-2 hover:text-ink active:bg-fill-2"
                    >
                      <X size={17} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </Card>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
