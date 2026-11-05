import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { GoogleLogo, LogoMark } from '../components/ui/brand';
import { Button } from '../components/ui/Button';
import type { Backend } from '../data/backend';

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

export function SignIn({ backend }: { backend: Backend }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      await backend.auth.signInWithGoogle();
    } catch (e) {
      console.error(e);
      toast({ message: 'Sign-in didn’t work. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-[env(safe-area-inset-top)]">
      {/* Soft color wash behind the mark */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(52,199,89,0.16) 0%, rgba(0,180,166,0.08) 45%, transparent 70%)' }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col items-center justify-center text-center">
        <motion.div {...rise(0)}>
          <LogoMark size={88} />
        </motion.div>
        <motion.h1 {...rise(0.12)} className="mt-8 text-[44px] font-bold leading-none tracking-[-0.035em]">
          Plate
        </motion.h1>
        <motion.p {...rise(0.22)} className="mt-4 max-w-[300px] text-[19px] leading-snug tracking-[-0.01em] text-ink-2">
          Say what you ate. Snap a photo.
          <br />
          Plate does the counting.
        </motion.p>
      </div>

      <motion.div {...rise(0.36)} className="relative mx-auto w-full max-w-[400px]">
        <Button
          variant="secondary"
          onClick={signIn}
          disabled={busy}
          className="bg-surface shadow-card ring-1 ring-black/[0.06]"
        >
          {busy ? <Loader2 size={20} className="animate-spin text-ink-2" /> : <GoogleLogo />}
          Continue with Google
        </Button>
        <p className="mt-4 text-center text-[13px] text-ink-3">Your food log is private to your account.</p>
      </motion.div>
    </div>
  );
}
