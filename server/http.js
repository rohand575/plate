// @ts-check

/** An error whose message is safe to show to the person using the app. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** @param {string} name */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(500, `The server is missing its ${name} setting.`);
  return value;
}

/** The Firebase project ID; the client build's variable is reused so it only has to be set once. */
export const projectId = () => process.env.FIREBASE_PROJECT_ID || requireEnv('VITE_FIREBASE_PROJECT_ID');
