// @ts-check
import { HttpError, projectId } from './http.js';

const RETRYABLE = new Set(['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED']);

/**
 * Counts AI requests per person per (UTC) day in `users/{uid}/usage/{day}`.
 *
 * The write uses the person's own ID token through the Firestore REST API, so no service
 * account is needed. The security rules only allow the counter to be created at 1 or raised
 * by exactly 1, so it can't be reset from the app; a precondition on each write keeps
 * parallel requests from double-counting.
 *
 * @param {{ uid: string; token: string }} user
 * @param {number} limit
 * @returns {Promise<{ used: number; limit: number }>}
 */
export async function consumeQuota(user, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/users/${user.uid}/usage/${day}`;
  const headers = { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' };

  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await fetch(url, { headers });
    let count = 0;
    let precondition = 'currentDocument.exists=false';
    if (current.ok) {
      const doc = /** @type {{ fields?: { count?: { integerValue?: string } }; updateTime: string }} */ (
        await current.json()
      );
      count = Number(doc.fields?.count?.integerValue ?? 0);
      precondition = `currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
    } else if (current.status !== 404) {
      throw await firestoreError(current);
    }

    if (count >= limit) {
      throw new HttpError(429, `You’ve used all ${limit} AI logs for today. You can still add food by hand.`);
    }

    const write = await fetch(`${url}?${precondition}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          count: { integerValue: String(count + 1) },
          day: { stringValue: day },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    if (write.ok) return { used: count + 1, limit };

    const status = await write
      .clone()
      .json()
      .then((b) => /** @type {{ error?: { status?: string } }} */ (b).error?.status ?? '')
      .catch(() => '');
    if (!RETRYABLE.has(status)) throw await firestoreError(write);
    // Another request updated the counter first — read it again.
  }
  throw new HttpError(503, 'Too many requests at once. Please try again.');
}

/** @param {Response} res */
async function firestoreError(res) {
  console.error('Usage counter request failed', res.status, await res.text());
  if (res.status === 401) return new HttpError(401, 'Your session has expired. Please sign in again.');
  if (res.status === 403) {
    return new HttpError(500, 'Daily limits aren’t set up yet — publish the latest Firestore rules (see README).');
  }
  return new HttpError(502, 'Couldn’t check your daily limit. Please try again.');
}
