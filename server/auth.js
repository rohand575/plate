// @ts-check
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, projectId } from './http.js';

// Public keys Google uses to sign Firebase ID tokens (cached between requests).
const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>`.
 * @param {string | null} header
 * @returns {Promise<{ uid: string; email: string | null; token: string }>}
 */
export async function verifyUser(header) {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Please sign in again.');
  const id = projectId();
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${id}`,
      audience: id,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('Token has no subject');
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null, token };
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
}

/**
 * When ALLOWED_EMAILS is set (comma-separated), only those accounts may use AI logging.
 * @param {string | null} email
 */
export function assertAllowed(email) {
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && (!email || !allowed.includes(email.toLowerCase()))) {
    throw new HttpError(403, 'AI logging isn’t enabled for this account yet.');
  }
}
