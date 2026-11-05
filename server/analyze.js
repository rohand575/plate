// @ts-check
import OpenAI from 'openai';
import { assertAllowed, verifyUser } from './auth.js';
import { HttpError, json } from './http.js';
import { analyzeMeal, transcribe } from './openai.js';
import { consumeQuota } from './quota.js';

// Vercel caps request bodies at 4.5 MB; base64 adds a third, so ~3 MB of audio or image.
const MAX_BASE64 = 4_000_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * @typedef {{ kind: 'text'; text: string }
 *   | { kind: 'audio'; audio: Buffer; mimeType: string }
 *   | { kind: 'photo'; imageDataUrl: string; note: string | null }} AnalyzeInput
 */

/**
 * @param {any} body
 * @returns {AnalyzeInput}
 */
function parseBody(body) {
  const bad = (/** @type {string} */ message) => new HttpError(400, message);
  if (!body || typeof body !== 'object') throw bad('Invalid request.');

  if (body.kind === 'text') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) throw bad('Describe what you ate first.');
    if (text.length > 1000) throw bad('That description is too long — keep it under 1,000 characters.');
    return { kind: 'text', text };
  }

  if (body.kind === 'audio') {
    if (typeof body.audio !== 'string' || !body.audio) throw bad('No recording received.');
    if (body.audio.length > MAX_BASE64) throw bad('That recording is too long. Keep it under 30 seconds.');
    const mimeType = typeof body.mimeType === 'string' && body.mimeType.startsWith('audio/') ? body.mimeType : 'audio/webm';
    return { kind: 'audio', audio: Buffer.from(body.audio, 'base64'), mimeType };
  }

  if (body.kind === 'photo') {
    if (typeof body.image !== 'string' || !body.image) throw bad('No photo received.');
    if (body.image.length > MAX_BASE64) throw bad('That photo is too large.');
    const type = IMAGE_TYPES.has(body.mimeType) ? body.mimeType : 'image/jpeg';
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null;
    return { kind: 'photo', imageDataUrl: `data:${type};base64,${body.image}`, note };
  }

  throw bad('Invalid request.');
}

/**
 * POST /api/analyze — turns a voice recording, typed description or photo into food items.
 * @param {Request} request
 */
export async function handleAnalyze(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifyUser(request.headers.get('authorization'));
    assertAllowed(user.email);
    const input = parseBody(await request.json().catch(() => null));
    const usage = await consumeQuota(user, Number(process.env.AI_DAILY_LIMIT) || 40);

    let transcript = null;
    let analysis;
    if (input.kind === 'audio') {
      transcript = await transcribe(input.audio, input.mimeType);
      if (!transcript) throw new HttpError(422, 'I didn’t catch that. Try again a little closer to the mic.');
      analysis = await analyzeMeal({ text: transcript });
    } else if (input.kind === 'text') {
      transcript = input.text;
      analysis = await analyzeMeal({ text: input.text });
    } else {
      analysis = await analyzeMeal({ imageDataUrl: input.imageDataUrl, note: input.note });
    }

    return json({ transcript, analysis, usage });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI request failed', error.status, error.message);
      const message =
        error.status === 429
          ? 'The AI service is busy or out of credits. Please try again shortly.'
          : 'The AI service had a problem. Please try again.';
      return json({ error: message }, 502);
    }
    console.error('Analyze failed', error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
