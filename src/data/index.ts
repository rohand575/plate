import type { Backend } from './backend';

export const isDemo = import.meta.env.VITE_DEMO === 'true';

let backend: Promise<Backend> | undefined;

/** Creates the backend once; Firebase can only be initialised a single time per page. */
export function loadBackend(): Promise<Backend> {
  backend ??= isDemo
    ? import('./demo').then((m) => m.createDemoBackend())
    : import('./firebase').then((m) => m.createFirebaseBackend());
  return backend;
}
