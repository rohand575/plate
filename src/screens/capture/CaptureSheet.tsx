import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import { Sheet } from '../../components/ui/Sheet';
import { AiError } from '../../data/backend';
import type { Recording } from '../../hooks/useRecorder';
import { haptic } from '../../lib/haptics';
import type { PreparedImage } from '../../lib/image';
import type { SavedCheck } from '../../lib/later';
import { sheetSpring } from '../../lib/motion';
import type { AnalyzeInput, AnalyzeResult, DateKey, Entry } from '../../lib/types';
import { AddFoodForm } from '../home/AddFoodForm';
import { CameraStage } from './CameraStage';
import { RecordStage } from './RecordStage';
import { type DayBudget, ReviewStage, type ReviewTarget } from './ReviewStage';
import { AnalyzingStage, type CaptureMode, ComposeStage, PhotoStage, ProblemStage } from './stages';

/** Opens the sheet: a new capture, a meal saved with "Decide later", or a logged entry to edit. */
export type CaptureRequest = { id: number } & (
  | { mode: 'voice' }
  | { mode: 'text' }
  | { mode: 'photo' }
  | { mode: 'saved'; check: SavedCheck }
  | { mode: 'edit'; entry: Entry }
);

type Stage =
  | { name: 'record' }
  | { name: 'compose' }
  | { name: 'manual' }
  | { name: 'camera' }
  | { name: 'photo' }
  | { name: 'analyzing' }
  | { name: 'review'; result: AnalyzeResult; run: number }
  | { name: 'problem'; title: string; message: string; retry: () => void };

const TITLES: Record<Stage['name'], string> = {
  record: 'Say what you ate',
  compose: 'Describe your meal',
  manual: 'Add food',
  camera: 'Snap your meal',
  photo: 'Your photo',
  analyzing: 'Estimating',
  review: 'Check and add',
  problem: 'Hmm',
};

/** A logged entry in the shape the review screen edits. */
function entryResult(entry: Entry): AnalyzeResult {
  return {
    transcript: entry.source === 'photo' ? null : entry.transcript,
    usage: null,
    analysis: {
      title: entry.title,
      confidence: 'high',
      note: null,
      tip: null,
      items: entry.items.map((item) => ({ ...item, quantity: item.quantity ?? 1, unit: item.unit ?? 'serving', assumption: null })),
    },
  };
}

function initialMode(request: CaptureRequest): CaptureMode {
  if (request.mode === 'saved') return request.check.source;
  if (request.mode === 'edit') return request.entry.source === 'manual' ? 'text' : request.entry.source;
  return request.mode;
}

function initialStage(request: CaptureRequest): Stage {
  switch (request.mode) {
    case 'voice':
      return { name: 'record' };
    case 'text':
      return { name: 'compose' };
    case 'photo':
      return { name: 'camera' };
    case 'saved': {
      const { source, transcript, analysis } = request.check;
      return { name: 'review', result: { transcript: source === 'photo' ? null : transcript, analysis, usage: null }, run: 0 };
    }
    case 'edit':
      return request.entry.source === 'manual' ? { name: 'manual' } : { name: 'review', result: entryResult(request.entry), run: 0 };
  }
}

/** The note typed alongside a photo, which is kept as the entry's transcript. */
function initialNote(request: CaptureRequest): string | null {
  if (request.mode === 'saved' && request.check.source === 'photo') return request.check.transcript;
  if (request.mode === 'edit' && request.entry.source === 'photo') return request.entry.transcript;
  return null;
}

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
  budget: DayBudget;
  onTitle: (title: string) => void;
  onDone: () => void;
  onDelete: (entry: Entry) => void;
}

function CaptureFlow({ request, date, budget, onTitle, onDone, onDelete }: FlowProps) {
  const { backend, profile } = useSession();
  const [mode, setMode] = useState<CaptureMode>(() => initialMode(request));
  const [stage, setStage] = useState<Stage>(() => initialStage(request));
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(() => initialNote(request));
  const runs = useRef(0);
  const alive = useRef(true);

  const editEntry = request.mode === 'edit' ? request.entry : undefined;
  const target: ReviewTarget = editEntry
    ? { kind: 'edit', entry: editEntry }
    : request.mode === 'saved'
      ? { kind: 'saved', id: request.check.id }
      : { kind: 'new' };
  const title = editEntry && (stage.name === 'review' || stage.name === 'manual') ? 'Edit meal' : TITLES[stage.name];

  useLayoutEffect(() => onTitle(title), [title, onTitle]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Release a photo's preview once it's replaced by a retake, or when the sheet closes.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const analyze = useCallback(
    async (input: AnalyzeInput) => {
      setStage({ name: 'analyzing' });
      try {
        const result = await backend.ai.analyze(input, profile.kitchen ?? null);
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
    [backend, profile.kitchen],
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

  function onImage(prepared: PreparedImage) {
    if (!alive.current) return URL.revokeObjectURL(prepared.url);
    setImage(prepared);
    setStage({ name: 'photo' });
  }

  function onImageFailed() {
    if (!alive.current) return;
    setStage({
      name: 'problem',
      title: 'Couldn’t open that photo',
      message: 'Try taking it again, or pick a different picture.',
      retry: () => setStage({ name: 'camera' }),
    });
  }

  const typeInstead = () => {
    setMode('text');
    setStage({ name: 'compose' });
  };
  const retry = () => setStage(mode === 'photo' ? { name: 'camera' } : mode === 'voice' ? { name: 'record' } : { name: 'compose' });
  const remove = (entry: Entry) => {
    onDelete(entry);
    onDone();
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
      content = <AddFoodForm date={date} entry={editEntry} onDone={onDone} onDelete={remove} />;
      break;
    case 'camera':
      content = <CameraStage onImage={onImage} onFailed={onImageFailed} onTypeInstead={typeInstead} />;
      break;
    case 'photo':
      content = image && (
        <PhotoStage
          image={image}
          onRetake={() => setStage({ name: 'camera' })}
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
          target={target}
          budget={budget}
          onDone={onDone}
          onRetry={retry}
          onReanalyze={(text) => void analyze({ kind: 'text', text })}
          onDelete={remove}
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

/** One sheet for logging food (voice, photo, description or manual entry) and for editing it later. */
export function CaptureSheet({
  request,
  date,
  budget,
  onClose,
  onDelete,
}: {
  request: CaptureRequest | null;
  date: DateKey;
  budget: DayBudget;
  onClose: () => void;
  onDelete: (entry: Entry) => void;
}) {
  const [title, setTitle] = useState('');
  return (
    <Sheet open={request != null} onClose={onClose} title={title}>
      {request && (
        <CaptureFlow key={request.id} request={request} date={date} budget={budget} onTitle={setTitle} onDone={onClose} onDelete={onDelete} />
      )}
    </Sheet>
  );
}
