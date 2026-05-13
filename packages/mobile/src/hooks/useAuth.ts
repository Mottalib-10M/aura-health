/**
 * useAuth Hook
 *
 * Provides authentication operations: login (password & biometric),
 * registration, logout, and secure token management using
 * expo-secure-store. Integrates with the Zustand auth store for
 * global auth state and the GraphQL API for server communication.
 */

import { useCallback, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../services/api';
import type { LoginRequest, AuthTokenPair } from '@aura/shared/types/auth';

// ---------------------------------------------------------------------------
// Secure Store Keys
// ---------------------------------------------------------------------------

const SECURE_KEYS = {
  ACCESS_TOKEN: 'aura_access_token',
  REFRESH_TOKEN: 'aura_refresh_token',
  USER_ID: 'aura_user_id',
  BIOMETRIC_ENABLED: 'aura_biometric_enabled',
  BIOMETRIC_TOKEN: 'aura_biometric_token',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseAuthReturn {
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Error message from the last failed operation */
  error: string | null;
  /** Login with email/phone + password */
  login: (identifier: string, password: string, isEmail?: boolean) => Promise<boolean>;
  /** Login using device biometrics (fingerprint/face) */
  loginWithBiometric: () => Promise<boolean>;
  /** Register a new patient account */
  register: (data: RegistrationData) => Promise<boolean>;
  /** Logout and clear all stored credentials */
  logout: () => Promise<void>;
  /** Refresh the access token using the stored refresh token */
  refreshToken: () => Promise<boolean>;
  /** Save tokens to secure storage after successful auth */
  saveTokens: (tokens: AuthTokenPair) => Promise<void>;
  /** Check if biometric login is configured for this device */
  isBiometricEnabled: () => Promise<boolean>;
  /** Enable biometric login for the current user */
  enableBiometric: (biometricToken: string) => Promise<void>;
  /** Clear the error state */
  clearError: () => void;
}

interface RegistrationData {
  phone: string;
  countryCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'other';
  region: string;
  city: string;
  preferredLanguage: string;
  otpCode: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuthenticated, setUser, clearAuth } = useAuthStore();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Persists auth tokens in secure, encrypted device storage.
   */
  const saveTokens = useCallback(async (tokens: AuthTokenPair) => {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, tokens.access_token),
      SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, tokens.refresh_token),
    ]);
  }, []);

  /**
   * Removes all stored credentials from secure storage.
   */
  const clearStoredCredentials = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(SECURE_KEYS.USER_ID),
    ]);
  }, []);

  /**
   * Authenticates with email/phone and password.
   */
  const login = useCallback(
    async (identifier: string, password: string, isEmail = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const loginPayload: LoginRequest = {
          password,
          ...(isEmail ? { email: identifier } : { phone: identifier }),
        };

        const response = await apiClient.login(loginPayload);

        if (!response.success || !response.tokens || !response.user) {
          setError(response.error || 'Login failed. Please check your credentials.');
          return false;
        }

        await saveTokens(response.tokens);
        await SecureStore.setItemAsync(SECURE_KEYS.USER_ID, response.user.id);

        setUser({
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
        });
        setAuthenticated(true);

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [saveTokens, setAuthenticated, setUser]
  );

  /**
   * Authenticates using stored biometric token and device biometrics.
   * The actual biometric check is handled by useBiometric; this method
   * takes the stored biometric auth token and exchanges it for a session.
   */
  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const biometricToken = await SecureStore.getItemAsync(
        SECURE_KEYS.BIOMETRIC_TOKEN
      );
      const userId = await SecureStore.getItemAsync(SECURE_KEYS.USER_ID);

      if (!biometricToken || !userId) {
        setError('Biometric login is not configured. Please log in with your password.');
        return false;
      }

      const response = await apiClient.loginWithBiometric(userId, biometricToken);

      if (!response.success || !response.tokens || !response.user) {
        setError(response.error || 'Biometric authentication failed.');
        return false;
      }

      await saveTokens(response.tokens);

      setUser({
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role,
      });
      setAuthenticated(true);

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Biometric login failed.';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveTokens, setAuthenticated, setUser]);

  /**
   * Registers a new patient account.
   */
  const register = useCallback(
    async (data: RegistrationData): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.register({
          phone: `${data.countryCode}${data.phone}`,
          first_name: data.firstName,
          last_name: data.lastName,
          date_of_birth: data.dateOfBirth,
          sex: data.sex,
          region: data.region,
          city: data.city,
          preferred_language: data.preferredLanguage,
          otp_code: data.otpCode,
        });

        if (!response.success || !response.tokens || !response.user) {
          setError(response.error || 'Registration failed.');
          return false;
        }

        await saveTokens(response.tokens);
        await SecureStore.setItemAsync(SECURE_KEYS.USER_ID, response.user.id);

        setUser({
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
        });
        setAuthenticated(true);

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Registration failed.';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [saveTokens, setAuthenticated, setUser]
  );

  /**
   * Logs out the user and clears all stored credentials.
   */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      // Notify backend of logout (best effort)
      const token = await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
      if (token) {
        await apiClient.logout().catch(() => {
          // Server-side logout failure is non-fatal
        });
      }
    } finally {
      await clearStoredCredentials();
      clearAuth();
      setIsLoading(false);
    }
  }, [clearAuth, clearStoredCredentials]);

  /**
   * Refreshes the access token using the stored refresh token.
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(
        SECURE_KEYS.REFRESH_TOKEN
      );

      if (!storedRefreshToken) {
        return false;
      }

      const response = await apiClient.refreshToken(storedRefreshToken);

      if (!response.tokens) {
        return false;
      }

      await saveTokens(response.tokens);
      return true;
    } catch {
      return false;
    }
  }, [saveTokens]);

  /**
   * Checks whether biometric login is enabled for this device.
   */
  const isBiometricEnabled = useCallback(async (): Promise<boolean> => {
    const enabled = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
    return enabled === 'true';
  }, []);

  /**
   * Enables biometric login by storing the biometric auth token.
   */
  const enableBiometric = useCallback(async (biometricToken: string) => {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_TOKEN, biometricToken),
      SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true'),
    ]);
  }, []);

  return {
    isLoading,
    error,
    login,
    loginWithBiometric,
    register,
    logout,
    refreshToken,
    saveTokens,
    isBiometricEnabled,
    enableBiometric,
    clearError,
  };
}
