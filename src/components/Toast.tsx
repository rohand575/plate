import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { spring } from '../lib/motion';

interface ToastInput {
  message: string;
  action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((input: ToastInput) => {
    window.clearTimeout(timer.current);
    const item = { ...input, id: Date.now() };
    setToast(item);
    timer.current = window.setTimeout(
      () => setToast((cur) => (cur?.id === item.id ? null : cur)),
      input.action ? 5000 : 2800,
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+108px)] z-[60] flex justify-center px-4 lg:bottom-8"
        >
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={spring}
                className="pointer-events-auto flex min-h-12 items-center gap-4 rounded-full bg-[#1d1d1f]/92 py-2 pl-5 pr-2 text-[15px] font-medium text-white shadow-float backdrop-blur-xl"
              >
                <span className="py-1">{toast.message}</span>
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action!.onClick();
                      setToast(null);
                    }}
                    className="rounded-full bg-white/15 px-4 py-2 text-[14px] font-semibold"
                  >
                    {toast.action.label}
                  </button>
                ) : (
                  <span className="w-1" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
