import { create } from 'zustand';
import type { User } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

interface AuthState {
  token: string | null;
  user: User | null;
  activeTenantId: string | null;
  isAuthenticated: boolean;
  pendingChallenge: string | null;
  requires2FASetup: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setActiveTenantId: (tenantId: string | null) => void;
  setPendingChallenge: (challengeToken: string) => void;
  clearPendingChallenge: () => void;
  setRequires2FASetup: (value: boolean) => void;
}

function readStoredAuth(): { token: string; user: User } | null {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const userStr = localStorage.getItem(STORAGE_KEYS.user);
  if (token && userStr) {
    try {
      return { token, user: JSON.parse(userStr) as User };
    } catch {
      return null;
    }
  }
  return null;
}

const stored = readStoredAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: stored?.token ?? null,
  user: stored?.user ?? null,
  activeTenantId: localStorage.getItem('sg_active_tenant'),
  isAuthenticated: !!stored,
  pendingChallenge: null,
  requires2FASetup: false,

  login: (token, user) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    set({ token, user, isAuthenticated: true, pendingChallenge: null, requires2FASetup: false });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem('sg_active_tenant');
    set({ token: null, user: null, activeTenantId: null, isAuthenticated: false, pendingChallenge: null, requires2FASetup: false });
  },

  setActiveTenantId: (tenantId) => {
    if (tenantId) {
      localStorage.setItem('sg_active_tenant', tenantId);
    } else {
      localStorage.removeItem('sg_active_tenant');
    }
    set({ activeTenantId: tenantId });
  },

  setPendingChallenge: (challengeToken) => {
    set({ pendingChallenge: challengeToken });
  },

  clearPendingChallenge: () => {
    set({ pendingChallenge: null });
  },

  setRequires2FASetup: (value) => {
    set({ requires2FASetup: value });
  },
}));
