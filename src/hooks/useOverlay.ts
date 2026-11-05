import { useEffect, useId, useRef } from 'react';

/*
 * Lets the system back button / gesture close the topmost open overlay (sheet or pushed
 * screen) instead of leaving the app — this matters most for the installed Android app.
 *
 * Each open overlay owns one history entry tagged with its id. Closing from the UI pops
 * that entry; pressing back pops it and closes the overlay. The `history.back()` on close
 * is deferred a tick so a remount (React StrictMode re-running effects) can reclaim the
 * same entry instead of losing it.
 */

const stack: string[] = [];
const closers = new Map<string, () => void>();
const currentOverlay = () => (history.state as { overlay?: string } | null)?.overlay;

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('popstate', () => {
    const current = currentOverlay();
    const keep = current ? stack.indexOf(current) : -1;
    stack
      .slice(keep + 1)
      .reverse()
      .forEach((id) => closers.get(id)?.());
  });
}

export function useBackClose(open: boolean, onClose: () => void) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    listen();
    stack.push(id);
    closers.set(id, () => closeRef.current());
    if (currentOverlay() !== id) history.pushState({ overlay: id }, '');

    return () => {
      stack.splice(stack.indexOf(id), 1);
      closers.delete(id);
      window.setTimeout(() => {
        if (!stack.includes(id) && currentOverlay() === id) history.back();
      }, 0);
    };
  }, [open, id]);
}

let locks = 0;

/** Stops the page behind an overlay from scrolling. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      locks -= 1;
      if (locks === 0) document.documentElement.style.overflow = '';
    };
  }, [active]);
}
