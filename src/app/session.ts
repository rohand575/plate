import { createContext, useContext } from 'react';
import type { Backend } from '../data/backend';
import type { AppUser, Profile } from '../lib/types';

export interface Session {
  backend: Backend;
  user: AppUser;
  profile: Profile;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside a signed-in, onboarded session');
  return session;
}
