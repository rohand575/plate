import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useIsWide } from '../../hooks/useMediaQuery';
import { useBackClose, useScrollLock } from '../../hooks/useOverlay';
import { sheetSpring, spring } from '../../lib/motion';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones (drag the handle down to dismiss), centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const wide = useIsWide();
  const drag = useDragControls();
  useBackClose(open, onClose);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const header = (
    <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <IconButton label="Close" onClick={onClose} className="size-8">
        <X size={17} strokeWidth={2.4} className="text-ink-2" />
      </IconButton>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          {wide ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="pointer-events-auto max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-[28px] bg-surface pt-4 shadow-float"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 6 }}
                transition={spring}
              >
                {header}
                {children}
              </motion.div>
            </div>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-float"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetSpring}
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) onClose();
              }}
            >
              <div className="touch-none cursor-grab" onPointerDown={(e) => drag.start(e)}>
                <div className="flex justify-center pb-2 pt-2.5">
                  <div className="h-[5px] w-9 rounded-full bg-fill" />
                </div>
                {header}
              </div>
              {children}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
