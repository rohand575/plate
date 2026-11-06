import { Images, Zap, ZapOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera';
import { cx } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { type PreparedImage, captureFrame, prepareImage } from '../../lib/image';
import { spring } from '../../lib/motion';
import { ProblemStage } from './stages';

const PROBLEMS = {
  denied: {
    title: 'Camera is blocked',
    message: 'Allow camera access for Plate in your browser’s site settings, or pick a photo from your gallery.',
  },
  missing: { title: 'No camera found', message: 'Pick a photo from your gallery instead.' },
  unsupported: { title: 'Can’t use the camera here', message: 'This browser can’t open the camera. Pick a photo from your gallery instead.' },
  error: { title: 'Couldn’t start the camera', message: 'Another app may be using it. Try again, or pick a photo from your gallery.' },
};

function RoundButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className={cx('flex size-12 items-center justify-center rounded-full text-ink transition-colors disabled:opacity-30', className)}
    >
      {children}
    </motion.button>
  );
}

/** Live viewfinder with a shutter button; the gallery is one tap away. */
export function CameraStage({
  onImage,
  onFailed,
  onTypeInstead,
}: {
  onImage: (image: PreparedImage) => void;
  onFailed: () => void;
  onTypeInstead: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useCamera(video);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState(0);

  function use(pending: Promise<PreparedImage>) {
    setBusy(true);
    pending.then(onImage, onFailed);
  }

  function shoot() {
    const el = video.current;
    if (!el || camera.state !== 'ready' || busy) return;
    haptic(8);
    setShots((n) => n + 1);
    use(captureFrame(el));
    el.pause();
  }

  const pickFile = () => picker.current?.click();
  const fileInput = (
    <input
      ref={picker}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) use(prepareImage(file));
      }}
    />
  );

  if (camera.state !== 'starting' && camera.state !== 'ready') {
    const problem = PROBLEMS[camera.state];
    return (
      <>
        {fileInput}
        {busy ? (
          <div className="shimmer mx-5 mb-5 aspect-[4/3] rounded-[22px]" />
        ) : (
          <ProblemStage
            title={problem.title}
            message={problem.message}
            primary={{ label: 'Choose from gallery', onClick: pickFile }}
            secondary={
              camera.state === 'denied' || camera.state === 'error'
                ? { label: 'Try the camera again', onClick: camera.retry }
                : { label: 'Describe it instead', onClick: onTypeInstead }
            }
          />
        )}
      </>
    );
  }

  const ready = camera.state === 'ready';
  return (
    <div className="px-5 pb-5">
      {fileInput}
      <div className="relative aspect-[3/4] max-h-[58dvh] w-full overflow-hidden rounded-[22px] bg-[#111] md:aspect-[4/3]">
        <video ref={video} muted playsInline autoPlay className="size-full object-cover" />
        <AnimatePresence>
          {!ready && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.3 } }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-[15px] font-medium text-white/60"
            >
              Starting the camera…
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {shots > 0 && (
            <motion.div
              key={shots}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-0 bg-white"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 grid grid-cols-3 items-center">
        <RoundButton label="Choose from gallery" onClick={pickFile} disabled={busy} className="justify-self-start bg-fill-2">
          <Images size={22} />
        </RoundButton>
        <motion.button
          type="button"
          aria-label="Take photo"
          onClick={shoot}
          disabled={!ready || busy}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          className="flex size-[72px] items-center justify-center justify-self-center rounded-full border-[3px] border-ink transition-opacity disabled:opacity-40"
        >
          <span className="size-[58px] rounded-full bg-ink" />
        </motion.button>
        {camera.torch != null ? (
          <RoundButton
            label={camera.torch ? 'Turn off the light' : 'Turn on the light'}
            onClick={camera.toggleTorch}
            className={cx('justify-self-end', camera.torch ? 'bg-ink text-white' : 'bg-fill-2')}
          >
            {camera.torch ? <Zap size={20} /> : <ZapOff size={20} />}
          </RoundButton>
        ) : (
          <span />
        )}
      </div>
      <p className="mt-3 text-center text-[14px] text-ink-2">Fit the whole plate in the frame — or, for packaged food, its nutrition label.</p>
    </div>
  );
}
