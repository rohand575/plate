import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Entry, Profile } from '../lib/types';
import { analyzeWithApi } from './aiClient';
import { type Backend, ConfigError, byLoggedAt } from './backend';

const env = import.meta.env;

/**
 * Redirect sign-in (used on phones and in the installed app) only works reliably when
 * Firebase's auth handler is same-origin with the app. Deployed builds proxy /__/auth to
 * Firebase (see vercel.json), so they use their own host; local dev uses Firebase's domain.
 */
function authDomain(): string {
  const { host, hostname } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+(\.\d+){3}$/.test(hostname);
  return import.meta.env.PROD && !local ? host : env.VITE_FIREBASE_AUTH_DOMAIN;
}

/** Installed apps and phones can't rely on popups; desktops prefer them. */
function prefersRedirect(): boolean {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const touch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return standalone || touch;
}

export function createFirebaseBackend(): Backend {
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_PROJECT_ID) {
    throw new ConfigError('Firebase is not configured');
  }

  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: authDomain(),
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  // Surfaces errors from a redirect sign-in that completed while the page was away.
  getRedirectResult(auth).catch((e) => console.error('Redirect sign-in failed', e));

  const userRef = (uid: string) => doc(db, 'users', uid);
  const entriesCol = (uid: string) => collection(db, 'users', uid, 'entries');

  return {
    kind: 'firebase',
    auth: {
      watch: (cb) =>
        onAuthStateChanged(auth, (u) =>
          cb(u ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } : null),
        ),
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        if (prefersRedirect()) return signInWithRedirect(auth, provider);
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          throw e;
        }
      },
      signOut: () => signOut(auth),
    },
    data: {
      watchProfile(uid, cb, onError) {
        return onSnapshot(
          userRef(uid),
          { includeMetadataChanges: true },
          (snap) => {
            // A cache miss on a new device isn't proof the user has no profile — wait for the server.
            if (!snap.exists() && snap.metadata.fromCache) return;
            cb((snap.data()?.profile as Profile | undefined) ?? null);
          },
          onError,
        );
      },
      async saveProfile(user, profile, { today, logWeight }) {
        const batch = writeBatch(db);
        batch.set(
          userRef(user.uid),
          {
            profile,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        if (logWeight) {
          batch.set(doc(db, 'users', user.uid, 'weights', today), {
            kg: profile.weightKg,
            date: today,
            loggedAt: Date.now(),
          });
        }
        await batch.commit();
      },
      async logWeight(uid, date, kg) {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', uid, 'weights', date), { kg, date, loggedAt: Date.now() });
        batch.set(userRef(uid), { profile: { weightKg: kg }, updatedAt: serverTimestamp() }, { merge: true });
        await batch.commit();
      },
      watchEntries(uid, from, to, cb, onError) {
        const q = query(entriesCol(uid), where('date', '>=', from), where('date', '<=', to));
        return onSnapshot(
          q,
          (snap) => {
            const entries = snap.docs.map((d) => {
              const { createdAt: _createdAt, updatedAt: _updatedAt, ...data } = d.data();
              return { id: d.id, ...data } as Entry;
            });
            cb(entries.sort(byLoggedAt));
          },
          onError,
        );
      },
      async addEntry(uid, entry) {
        await setDoc(doc(entriesCol(uid)), { ...entry, createdAt: serverTimestamp() });
      },
      async updateEntry(uid, id, entry) {
        // Merging keeps the original createdAt.
        await setDoc(doc(entriesCol(uid), id), { ...entry, updatedAt: serverTimestamp() }, { merge: true });
      },
      async restoreEntry(uid, { id, ...entry }) {
        await setDoc(doc(entriesCol(uid), id), { ...entry, createdAt: serverTimestamp() });
      },
      async deleteEntry(uid, id) {
        await deleteDoc(doc(entriesCol(uid), id));
      },
    },
    ai: {
      analyze: (input, kitchen) => analyzeWithApi(input, kitchen, async () => auth.currentUser?.getIdToken()),
    },
  };
}
