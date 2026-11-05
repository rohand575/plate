import { Camera, Keyboard, Mic } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/controls';
import { cx } from '../../lib/format';
import { spring } from '../../lib/motion';

export interface CaptureActions {
  onSpeak: () => void;
  onPhoto: () => void;
  onType: () => void;
}

function DockButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      className="flex size-12 items-center justify-center rounded-full text-ink"
    >
      {children}
    </motion.button>
  );
}

/** Floating capture controls on phones. */
export function CaptureDock({ onSpeak, onPhoto, onType }: CaptureActions) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-canvas from-25% to-transparent" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.2 }}
        className="relative flex justify-center pb-[max(env(safe-area-inset-bottom),18px)]"
      >
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/80 p-2 shadow-float ring-1 ring-black/[0.04] backdrop-blur-2xl">
          <DockButton label="Type what you ate" onClick={onType}>
            <Keyboard size={22} />
          </DockButton>
          <motion.button
            type="button"
            aria-label="Say what you ate"
            onClick={onSpeak}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            className="flex size-[60px] items-center justify-center rounded-full bg-ink text-white shadow-[0_6px_20px_rgb(0_0_0/0.25)]"
          >
            <Mic size={26} />
          </motion.button>
          <DockButton label="Photograph your food" onClick={onPhoto}>
            <Camera size={22} />
          </DockButton>
        </div>
      </motion.div>
    </div>
  );
}

function Tile({ label, icon, onClick, primary }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      transition={spring}
      className={cx(
        'flex flex-col items-center gap-2 rounded-[18px] py-4 text-[14px] font-semibold transition-colors',
        primary ? 'bg-ink text-white' : 'bg-fill-2 text-ink hover:bg-fill',
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}

/** Inline capture controls on wide screens. */
export function CaptureCard({ onSpeak, onPhoto, onType }: CaptureActions) {
  return (
    <Card className="hidden p-5 lg:block">
      <p className="text-[17px] font-semibold tracking-[-0.01em]">Log food</p>
      <p className="mt-0.5 text-[14px] text-ink-2">Say it, snap it, or type it.</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Tile primary label="Speak" icon={<Mic size={22} />} onClick={onSpeak} />
        <Tile label="Photo" icon={<Camera size={22} />} onClick={onPhoto} />
        <Tile label="Type" icon={<Keyboard size={22} />} onClick={onType} />
      </div>
    </Card>
  );
}
