import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'starting' | 'ready' | 'denied' | 'missing' | 'unsupported' | 'error';

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraints = MediaTrackConstraintSet & { torch: boolean };

// Missing on insecure origins (plain http on a LAN address) and very old browsers.
const supported = () => typeof navigator.mediaDevices?.getUserMedia === 'function';

function stateFor(error: unknown): CameraState {
  switch ((error as DOMException)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'missing';
    default:
      return 'error';
  }
}

/**
 * Live camera preview in `video`, preferring the back camera. `torch` is null when the
 * camera has no light to switch on (laptops, most front cameras).
 */
export function useCamera(video: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<CameraState>(() => (supported() ? 'starting' : 'unsupported'));
  const [torch, setTorch] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const track = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!supported()) return;
    let cancelled = false;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      })
      .then(async (s) => {
        stream = s;
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        const [t] = s.getVideoTracks();
        track.current = t;
        const el = video.current;
        if (el) {
          el.srcObject = s;
          await el.play().catch(() => {});
        }
        if (cancelled) return;
        setTorch((t.getCapabilities?.() as TorchCapabilities | undefined)?.torch ? false : null);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (!cancelled) setState(stateFor(e));
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      track.current = null;
      if (video.current) video.current.srcObject = null;
    };
  }, [video, attempt]);

  const retry = useCallback(() => {
    setState('starting');
    setAttempt((a) => a + 1);
  }, []);

  const toggleTorch = useCallback(() => {
    const t = track.current;
    if (!t || torch == null) return;
    const on = !torch;
    const constraints: TorchConstraints = { torch: on };
    t.applyConstraints({ advanced: [constraints] }).then(
      () => setTorch(on),
      () => setTorch(null),
    );
  }, [torch]);

  return { state, torch, toggleTorch, retry };
}
