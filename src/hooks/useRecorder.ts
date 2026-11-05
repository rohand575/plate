import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported' | 'error';

export interface Recording {
  blob: Blob;
  durationMs: number;
  /** False when nothing louder than background noise was picked up. */
  heardSpeech: boolean;
}

interface Session {
  cancelled: boolean;
  stopping: boolean;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  context?: AudioContext;
  timer?: number;
  chunks: Blob[];
  startedAt: number;
  heardSpeech: boolean;
  quietSince: number | null;
}

// OpenAI accepts webm and mp4/m4a; ogg isn't on its list.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const SPEECH_LEVEL = 0.16;

interface Options {
  maxMs?: number;
  /** Stop automatically after this much quiet once speech has been heard. */
  silenceMs?: number;
  onAutoStop: () => void;
}

/** Microphone recording with a live input level and automatic stop on silence. */
export function useRecorder({ maxMs = 30_000, silenceMs = 1_700, onAutoStop }: Options) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const session = useRef<Session | null>(null);
  const level = useRef(0);
  const autoStop = useRef(onAutoStop);
  autoStop.current = onAutoStop;

  const release = (s: Session) => {
    window.clearInterval(s.timer);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.context?.close().catch(() => {});
    level.current = 0;
  };

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('unsupported');
      return;
    }
    const s: Session = { cancelled: false, stopping: false, chunks: [], startedAt: 0, heardSpeech: false, quietSince: null };
    session.current = s;
    setState('starting');
    setSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (s.cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      s.stream = stream;

      const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) s.chunks.push(e.data);
      };
      recorder.start(250);
      s.recorder = recorder;

      const context = new AudioContext();
      void context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      s.context = context;

      const samples = new Uint8Array(analyser.fftSize);
      s.startedAt = performance.now();
      s.timer = window.setInterval(() => {
        if (s.stopping) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const value = Math.min(1, Math.sqrt(sum / samples.length) * 4.5);
        level.current = value;

        const now = performance.now();
        setSeconds(Math.floor((now - s.startedAt) / 1000));
        if (value > SPEECH_LEVEL) {
          s.heardSpeech = true;
          s.quietSince = null;
        } else if (s.heardSpeech) {
          s.quietSince ??= now;
          if (now - s.quietSince > silenceMs) autoStop.current();
        }
        if (now - s.startedAt > maxMs) autoStop.current();
      }, 50);

      setState('recording');
    } catch (e) {
      if (s.cancelled) return;
      setState((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [maxMs, silenceMs]);

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        const s = session.current;
        const recorder = s?.recorder;
        if (!s || !recorder || recorder.state === 'inactive' || s.stopping) return resolve(null);
        s.stopping = true;
        const durationMs = performance.now() - s.startedAt;
        recorder.onstop = () => {
          release(s);
          resolve({ blob: new Blob(s.chunks, { type: recorder.mimeType || 'audio/webm' }), durationMs, heardSpeech: s.heardSpeech });
        };
        recorder.stop();
        session.current = null;
        setState('idle');
      }),
    [],
  );

  const cancel = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop();
    release(s);
    session.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const getLevel = useCallback(() => level.current, []);
  return { state, seconds, getLevel, start, stop, cancel };
}
