import { create } from 'zustand';

import type { User } from '@/domain/auth/user';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  /** Signed in, but waiting for biometric unlock. */
  locked: boolean;
  signedIn: (user: User, options?: { locked?: boolean }) => void;
  signedOut: () => void;
  unlock: () => void;
};

export const useSession = create<SessionState>()((set) => ({
  status: 'booting',
  user: null,
  locked: false,
  signedIn: (user, options) => set({ status: 'signedIn', user, locked: options?.locked ?? false }),
  signedOut: () => set({ status: 'signedOut', user: null, locked: false }),
  unlock: () => set({ locked: false }),
}));

/** Non-null user for screens that only render behind the auth guard. */
export function useCurrentUser(): User {
  const user = useSession((state) => state.user);
  if (!user) throw new Error('useCurrentUser() called outside an authenticated route');
  return user;
}
