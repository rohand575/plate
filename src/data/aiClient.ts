import type { AnalyzeInput, AnalyzeResult } from '../lib/types';
import { AiError } from './backend';

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function requestBody(input: AnalyzeInput) {
  switch (input.kind) {
    case 'text':
      return { kind: 'text', text: input.text };
    case 'audio':
      return { kind: 'audio', audio: await toBase64(input.audio), mimeType: input.audio.type || 'audio/webm' };
    case 'photo':
      return { kind: 'photo', image: await toBase64(input.image), mimeType: input.image.type || 'image/jpeg', note: input.note };
  }
}

/** Calls POST /api/analyze (a Vercel Function in production, the Vite dev server locally). */
export async function analyzeWithApi(input: AnalyzeInput, getIdToken: () => Promise<string | undefined>): Promise<AnalyzeResult> {
  const token = await getIdToken();
  if (!token) throw new AiError('Please sign in again.');

  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(await requestBody(input)),
    });
  } catch {
    throw new AiError(navigator.onLine ? 'Couldn’t reach Plate’s server. Please try again.' : 'You’re offline. Connect to the internet and try again.');
  }

  const data = (await response.json().catch(() => null)) as (AnalyzeResult & { error?: string }) | null;
  if (!response.ok || !data) {
    if (response.status === 404) throw new AiError('The AI service isn’t running here yet.');
    throw new AiError(data?.error ?? 'Something went wrong. Please try again.');
  }
  return data;
}
