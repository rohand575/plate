import { Mic } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { type Recording, useRecorder } from '../../hooks/useRecorder';
import { spring } from '../../lib/motion';
import { ProblemStage } from './stages';

const BARS = 34;

/** Scrolling bar waveform; updates the DOM directly so it doesn't re-render React each frame. */
function Waveform({ getLevel }: { getLevel: () => number }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const history = new Array<number>(BARS).fill(0);
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 60) {
        last = t;
        history.shift();
        history.push(getLevel());
        history.forEach((v, i) => {
          const el = bars.current[i];
          if (el) el.style.transform = `scaleY(${Math.max(0.07, Math.min(1, v * 1.5))})`;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLevel]);

  return (
    <div className="flex h-14 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="h-full w-[3px] origin-center rounded-full bg-ink transition-transform duration-75"
          style={{ transform: 'scaleY(0.07)', opacity: 0.18 + 0.82 * (i / BARS) }}
        />
      ))}
    </div>
  );
}

function MicOrb({ getLevel }: { getLevel: () => number }) {
  const level = useMotionValue(0);
  const smooth = useSpring(level, { stiffness: 260, damping: 18 });
  const inner = useTransform(smooth, (v) => 1 + v * 0.45);
  const outer = useTransform(smooth, (v) => 1 + v * 0.95);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      level.set(getLevel());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLevel, level]);

  return (
    <div className="relative flex size-40 items-center justify-center">
      <motion.span style={{ scale: outer }} className="absolute size-24 rounded-full bg-brand/12" />
      <motion.span style={{ scale: inner }} className="absolute size-24 rounded-full bg-brand/22" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="relative flex size-24 items-center justify-center rounded-full bg-ink text-white shadow-[0_12px_32px_rgb(0_0_0/0.25)]"
      >
        <Mic size={36} />
      </motion.div>
    </div>
  );
}

export function RecordStage({
  onRecorded,
  onCancel,
  onTypeInstead,
}: {
  onRecorded: (recording: Recording) => void;
  onCancel: () => void;
  onTypeInstead: () => void;
}) {
  const finishing = useRef(false);
  const recorder = useRecorder({ onAutoStop: () => void finish() });
  const { start, cancel } = recorder;

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    const recording = await recorder.stop();
    if (recording) onRecorded(recording);
    else finishing.current = false;
  }

  useEffect(() => {
    void start();
    return cancel;
  }, [start, cancel]);

  if (recorder.state === 'denied') {
    return (
      <ProblemStage
        title="Microphone is blocked"
        message="Allow microphone access for Plate in your browser’s site settings, then try again."
        primary={{ label: 'Type it instead', onClick: onTypeInstead }}
        secondary={{ label: 'Try again', onClick: () => void start() }}
      />
    );
  }
  if (recorder.state === 'unsupported' || recorder.state === 'error') {
    return (
      <ProblemStage
        title="Can’t use the microphone"
        message={
          recorder.state === 'unsupported'
            ? 'This browser can’t record audio. Try Chrome, or type what you ate.'
            : 'Something went wrong starting the microphone.'
        }
        primary={{ label: 'Type it instead', onClick: onTypeInstead }}
      />
    );
  }

  const listening = recorder.state === 'recording';
  return (
    <div className="flex flex-col items-center px-6 pb-6 text-center">
      <MicOrb getLevel={recorder.getLevel} />
      <p className="text-[22px] font-semibold tracking-[-0.02em]">{listening ? 'Listening…' : 'Starting the mic…'}</p>
      <p className="mt-0.5 text-[15px] tabular-nums text-ink-2">0:{String(recorder.seconds).padStart(2, '0')}</p>
      <div className="mt-4 w-full">
        <Waveform getLevel={recorder.getLevel} />
      </div>
      <p className="mt-4 max-w-[320px] text-balance text-[15px] leading-snug text-ink-2">
        Say what you ate and roughly how much — like “two rotis, a katori of dal and a spoon of ghee”.
      </p>
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void finish()} disabled={!listening}>
          Done
        </Button>
      </div>
    </div>
  );
}
