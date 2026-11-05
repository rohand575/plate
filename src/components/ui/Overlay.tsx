import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsWide } from '../../hooks/useMediaQuery';
import { useBackClose, useScrollLock } from '../../hooks/useOverlay';
import { iosEase } from '../../lib/motion';

/**
 * A full-screen layer pushed over the current screen. Render it inside <AnimatePresence>.
 * `from="right"` behaves like a navigation push; `from="bottom"` like a modal.
 */
export function Overlay({
  onClose,
  from = 'right',
  children,
}: {
  onClose: () => void;
  from?: 'right' | 'bottom';
  children: ReactNode;
}) {
  const wide = useIsWide();
  useBackClose(true, onClose);
  useScrollLock(true);

  const hidden = wide
    ? { opacity: 0, y: from === 'bottom' ? 24 : 0, x: from === 'right' ? 24 : 0 }
    : from === 'right'
      ? { x: '100%' }
      : { y: '100%' };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-canvas"
      initial={hidden}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={hidden}
      transition={{ duration: wide ? 0.28 : 0.42, ease: iosEase }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}
