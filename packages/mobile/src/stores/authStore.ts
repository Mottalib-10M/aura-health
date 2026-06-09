/**
 * Auth Store (Zustand)
 *
 * Global authentication state persisted to expo-secure-store. Stores
 * the current user identity, authentication status, and session
 * metadata. The persist middleware uses a custom SecureStore adapter
 * so sensitive auth data is never written to AsyncStorage.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { UserRole } from '@uzavita/shared/types/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionId?: string;
  avatarUrl?: string;
}

interface AuthState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Current user information */
  user: UserInfo | null;
  /** Selected language code */
  language: string;
  /** Whether onboarding has been completed */
  onboardingComplete: boolean;
  /** Whether biometric login is enabled */
  biometricEnabled: boolean;
  /** Last active timestamp for session timeout detection */
  lastActiveAt: string | null;

  // Actions
  setAuthenticated: (authenticated: boolean) => void;
  setUser: (user: UserInfo | null) => void;
  setLanguage: (language: string) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  updateLastActive: () => void;
  clearAuth: () => void;
  restoreSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Secure Storage Adapter for Zustand persist
// ---------------------------------------------------------------------------

const secureStoreAdapter = createJSONStorage<AuthState>(() => ({
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      console.warn(`Failed to save ${name} to SecureStore`);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      console.warn(`Failed to remove ${name} from SecureStore`);
    }
  },
}));

// ---------------------------------------------------------------------------
// Session Timeout Configuration
// ---------------------------------------------------------------------------

/** Inactivity timeout in milliseconds (15 minutes) */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      language: 'en',
      onboardingComplete: false,
      biometricEnabled: false,
      lastActiveAt: null,

      // Actions
      setAuthenticated: (authenticated) =>
        set({
          isAuthenticated: authenticated,
          lastActiveAt: authenticated ? new Date().toISOString() : null,
        }),

      setUser: (user) => set({ user }),

      setLanguage: (language) => set({ language }),

      setOnboardingComplete: (complete) =>
        set({ onboardingComplete: complete }),

      setBiometricEnabled: (enabled) =>
        set({ biometricEnabled: enabled }),

      updateLastActive: () =>
        set({ lastActiveAt: new Date().toISOString() }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          user: null,
          lastActiveAt: null,
        }),

      restoreSession: async () => {
        const state = get();

        // Check if the session has timed out
        if (state.lastActiveAt) {
          const lastActive = new Date(state.lastActiveAt).getTime();
          const now = Date.now();
          const elapsed = now - lastActive;

          if (elapsed > SESSION_TIMEOUT_MS) {
            // Session expired - require re-authentication
            set({
              isAuthenticated: false,
              lastActiveAt: null,
            });
            return;
          }
        }

        // Check for stored access token
        try {
          const accessToken = await SecureStore.getItemAsync(
            'uzavita_access_token'
          );

          if (!accessToken) {
            set({ isAuthenticated: false });
            return;
          }

          // Token exists - mark session as active
          set({ lastActiveAt: new Date().toISOString() });
        } catch {
          set({ isAuthenticated: false });
        }
      },
    }),
    {
      name: 'uzavita-auth-store',
      storage: secureStoreAdapter,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        language: state.language,
        onboardingComplete: state.onboardingComplete,
        biometricEnabled: state.biometricEnabled,
        lastActiveAt: state.lastActiveAt,
      }),
    }
  )
);
