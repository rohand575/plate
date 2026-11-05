import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { SessionContext } from './app/session';
import { ToastProvider, useToast } from './components/Toast';
import { type Backend, ConfigError } from './data/backend';
import { loadBackend } from './data';
import { todayKey } from './lib/dates';
import type { AppUser, Profile } from './lib/types';
import { Home } from './screens/home/Home';
import { Onboarding } from './screens/onboarding/Onboarding';
import { SignIn } from './screens/SignIn';
import { BootError, SetupNeeded, Splash } from './screens/SystemScreens';

type Boot = { kind: 'loading' } | { kind: 'ready'; backend: Backend } | { kind: 'unconfigured' } | { kind: 'failed'; message: string };

/** Signed out → sign in; signed in without a profile → onboarding; otherwise the app. */
function Gate({ backend }: { backend: Backend }) {
  const toast = useToast();
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<{ uid: string; value: Profile | null } | null>(null);
  const uid = user?.uid;

  useEffect(() => backend.auth.watch(setUser), [backend]);

  useEffect(() => {
    if (!uid) return;
    return backend.data.watchProfile(
      uid,
      (value) => setProfile({ uid, value }),
      (e) => {
        console.error(e);
        toast({ message: 'Couldn’t load your profile.' });
      },
    );
  }, [backend, uid, toast]);

  const session = useMemo(
    () => (user && profile?.uid === user.uid && profile.value ? { backend, user, profile: profile.value } : null),
    [backend, user, profile],
  );

  function createProfile(p: Profile) {
    if (!user) return;
    backend.data
      .saveProfile(user, p, { today: todayKey(), logWeight: true })
      .catch(() => toast({ message: 'Couldn’t save your plan. Check your connection.' }));
  }

  let key: string;
  let screen: ReactNode;
  if (user === undefined) {
    [key, screen] = ['splash', <Splash />];
  } else if (user === null) {
    [key, screen] = ['signin', <SignIn backend={backend} />];
  } else if (profile?.uid !== user.uid) {
    [key, screen] = ['splash', <Splash />];
  } else if (!session) {
    [key, screen] = ['onboarding', <Onboarding user={user} onSave={createProfile} onSignOut={() => void backend.auth.signOut()} />];
  } else {
    [key, screen] = [
      'home',
      <SessionContext.Provider value={session}>
        <Home />
      </SessionContext.Provider>,
    ];
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
        {screen}
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const [boot, setBoot] = useState<Boot>({ kind: 'loading' });

  useEffect(() => {
    loadBackend().then(
      (backend) => setBoot({ kind: 'ready', backend }),
      (e: unknown) =>
        setBoot(e instanceof ConfigError ? { kind: 'unconfigured' } : { kind: 'failed', message: String(e) }),
    );
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {boot.kind === 'loading' && <Splash />}
        {boot.kind === 'unconfigured' && <SetupNeeded />}
        {boot.kind === 'failed' && <BootError message={boot.message} />}
        {boot.kind === 'ready' && <Gate backend={boot.backend} />}
      </ToastProvider>
    </MotionConfig>
  );
}
