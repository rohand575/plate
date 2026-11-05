import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import { Sheet } from '../../components/ui/Sheet';
import { AiError } from '../../data/backend';
import type { Recording } from '../../hooks/useRecorder';
import { haptic } from '../../lib/haptics';
import { type PreparedImage, prepareImage } from '../../lib/image';
import { sheetSpring } from '../../lib/motion';
import type { AnalyzeInput, AnalyzeResult, DateKey } from '../../lib/types';
import { AddFoodForm } from '../home/AddFoodForm';
import { RecordStage } from './RecordStage';
import { ReviewStage } from './ReviewStage';
import { AnalyzingStage, type CaptureMode, ComposeStage, PhotoStage, ProblemStage } from './stages';

export type CaptureRequest = { id: number } & ({ mode: 'voice' } | { mode: 'text' } | { mode: 'photo'; file: File });

type Stage =
  | { name: 'record' }
  | { name: 'compose' }
  | { name: 'manual' }
  | { name: 'preparing' }
  | { name: 'photo' }
  | { name: 'analyzing' }
  | { name: 'review'; result: AnalyzeResult; run: number }
  | { name: 'problem'; title: string; message: string; retry: () => void };

const TITLES: Record<Stage['name'], string> = {
  record: 'Say what you ate',
  compose: 'Describe your meal',
  manual: 'Add food',
  preparing: 'Your photo',
  photo: 'Your photo',
  analyzing: 'Estimating',
  review: 'Check and add',
  problem: 'Hmm',
};

/** Animates its height as the content changes between stages. */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height }} transition={sheetSpring} className="overflow-hidden">
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

interface FlowProps {
  request: CaptureRequest;
  date: DateKey;
  onTitle: (title: string) => void;
  onDone: () => void;
  onRetakePhoto: () => void;
}

function CaptureFlow({ request, date, onTitle, onDone, onRetakePhoto }: FlowProps) {
  const { backend } = useSession();
  const [mode, setMode] = useState<CaptureMode>(request.mode);
  const [stage, setStage] = useState<Stage>(() =>
    request.mode === 'voice' ? { name: 'record' } : request.mode === 'text' ? { name: 'compose' } : { name: 'preparing' },
  );
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const runs = useRef(0);
  const alive = useRef(true);
  const retakeRef = useRef(onRetakePhoto);
  retakeRef.current = onRetakePhoto;

  useLayoutEffect(() => onTitle(TITLES[stage.name]), [stage.name, onTitle]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Downscale the chosen photo before showing it.
  useEffect(() => {
    if (request.mode !== 'photo') return;
    let cancelled = false;
    let url: string | null = null;
    prepareImage(request.file).then(
      (prepared) => {
        if (cancelled) return URL.revokeObjectURL(prepared.url);
        url = prepared.url;
        setImage(prepared);
        setStage({ name: 'photo' });
      },
      () => {
        if (cancelled) return;
        setStage({
          name: 'problem',
          title: 'Couldn’t open that photo',
          message: 'Try taking it again, or pick a different picture.',
          retry: () => retakeRef.current(),
        });
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [request]);

  const analyze = useCallback(
    async (input: AnalyzeInput) => {
      setStage({ name: 'analyzing' });
      try {
        const result = await backend.ai.analyze(input);
        if (!alive.current) return;
        haptic(10);
        setStage({ name: 'review', result, run: ++runs.current });
      } catch (e) {
        if (!alive.current) return;
        setStage({
          name: 'problem',
          title: 'Couldn’t estimate that',
          message: e instanceof AiError ? e.message : 'Something went wrong. Please try again.',
          retry: () => void analyze(input),
        });
      }
    },
    [backend],
  );

  function onRecorded(recording: Recording) {
    if (!recording.heardSpeech || recording.durationMs < 700) {
      setStage({
        name: 'problem',
        title: 'I didn’t hear anything',
        message: 'Hold your phone a little closer and say what you ate.',
        retry: () => setStage({ name: 'record' }),
      });
      return;
    }
    void analyze({ kind: 'audio', audio: recording.blob });
  }

  const typeInstead = () => {
    setMode('text');
    setStage({ name: 'compose' });
  };
  const retry = () => {
    if (mode === 'photo') onRetakePhoto();
    else setStage(mode === 'voice' ? { name: 'record' } : { name: 'compose' });
  };

  let content: ReactNode;
  switch (stage.name) {
    case 'record':
      content = <RecordStage onRecorded={onRecorded} onCancel={onDone} onTypeInstead={typeInstead} />;
      break;
    case 'compose':
      content = (
        <ComposeStage
          onSubmit={(text) => void analyze({ kind: 'text', text })}
          onManual={() => setStage({ name: 'manual' })}
        />
      );
      break;
    case 'manual':
      content = <AddFoodForm date={date} onDone={onDone} />;
      break;
    case 'preparing':
      content = <div className="shimmer mx-5 mb-5 aspect-[4/3] rounded-[22px]" />;
      break;
    case 'photo':
      content = image && (
        <PhotoStage
          image={image}
          onRetake={onRetakePhoto}
          onSubmit={(note) => {
            setPhotoNote(note);
            void analyze({ kind: 'photo', image: image.blob, note });
          }}
        />
      );
      break;
    case 'analyzing':
      content = <AnalyzingStage mode={mode} image={image} />;
      break;
    case 'review':
      content = (
        <ReviewStage
          key={stage.run}
          result={stage.result}
          mode={mode}
          image={image}
          photoNote={photoNote}
          date={date}
          onSaved={onDone}
          onRetry={retry}
          onReanalyze={(text) => void analyze({ kind: 'text', text })}
        />
      );
      break;
    case 'problem':
      content = (
        <ProblemStage
          title={stage.title}
          message={stage.message}
          primary={{ label: 'Try again', onClick: stage.retry }}
          secondary={mode === 'text' ? { label: 'Enter it yourself', onClick: () => setStage({ name: 'manual' }) } : { label: 'Type it instead', onClick: typeInstead }}
        />
      );
      break;
  }

  return (
    <AutoHeight>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage.name === 'review' ? `review-${stage.run}` : stage.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </AutoHeight>
  );
}

/** One sheet for every way of logging food: voice, photo, description or manual entry. */
export function CaptureSheet({
  request,
  date,
  onClose,
  onRetakePhoto,
}: {
  request: CaptureRequest | null;
  date: DateKey;
  onClose: () => void;
  onRetakePhoto: () => void;
}) {
  const [title, setTitle] = useState('');
  return (
    <Sheet open={request != null} onClose={onClose} title={title}>
      {request && (
        <CaptureFlow key={request.id} request={request} date={date} onTitle={setTitle} onDone={onClose} onRetakePhoto={onRetakePhoto} />
      )}
    </Sheet>
  );
}
