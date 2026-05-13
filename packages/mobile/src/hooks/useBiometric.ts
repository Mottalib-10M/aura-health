/**
 * useBiometric Hook
 *
 * Wraps expo-local-authentication to provide biometric availability
 * checks, authentication prompts, and enrollment state management.
 * Supports both fingerprint and facial recognition hardware.
 */

import { useCallback, useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

interface UseBiometricReturn {
  /** Whether the device has biometric hardware */
  isAvailable: boolean;
  /** Whether the user has enrolled biometrics on this device */
  isEnrolled: boolean;
  /** The primary biometric type available on the device */
  biometricType: BiometricType;
  /** Whether biometric state is still loading */
  isLoading: boolean;
  /** Human-readable name for the biometric type (e.g. "Face ID") */
  biometricLabel: string;
  /** Prompt the user for biometric authentication */
  authenticate: (reason?: string) => Promise<BiometricResult>;
  /** Re-check biometric hardware availability */
  refresh: () => Promise<void>;
}

interface BiometricResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Helper: Map expo auth types to our BiometricType
// ---------------------------------------------------------------------------

function mapAuthType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris';
  }
  return 'none';
}

function getBiometricLabel(type: BiometricType): string {
  switch (type) {
    case 'face':
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    case 'fingerprint':
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    case 'iris':
      return 'Iris Recognition';
    case 'none':
      return 'Biometric';
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBiometric(): UseBiometricReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Checks biometric hardware availability and enrollment status.
   */
  const checkBiometric = useCallback(async () => {
    setIsLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      setIsAvailable(hasHardware);

      if (hasHardware) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsEnrolled(enrolled);

        const supportedTypes =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricType(mapAuthType(supportedTypes));
      } else {
        setIsEnrolled(false);
        setBiometricType('none');
      }
    } catch {
      setIsAvailable(false);
      setIsEnrolled(false);
      setBiometricType('none');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkBiometric();
  }, [checkBiometric]);

  /**
   * Triggers the device biometric authentication prompt.
   * Returns success/failure with an optional error message.
   */
  const authenticate = useCallback(
    async (reason?: string): Promise<BiometricResult> => {
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device.',
        };
      }

      if (!isEnrolled) {
        return {
          success: false,
          error:
            'No biometric credentials are enrolled. Please set up biometrics in your device settings.',
        };
      }

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: reason || 'Verify your identity to continue',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Passcode',
          disableDeviceFallback: false,
        });

        if (result.success) {
          return { success: true };
        }

        // Map expo error to user-friendly message
        switch (result.error) {
          case 'user_cancel':
            return {
              success: false,
              warning: 'Authentication cancelled.',
            };
          case 'user_fallback':
            return {
              success: false,
              warning: 'Passcode fallback selected.',
            };
          case 'system_cancel':
            return {
              success: false,
              error: 'Authentication was interrupted by the system.',
            };
          case 'lockout':
            return {
              success: false,
              error:
                'Too many failed attempts. Biometric authentication is temporarily locked.',
            };
          case 'not_enrolled':
            return {
              success: false,
              error: 'No biometrics enrolled on this device.',
            };
          default:
            return {
              success: false,
              error: 'Authentication failed. Please try again.',
            };
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred during authentication.',
        };
      }
    },
    [isAvailable, isEnrolled]
  );

  return {
    isAvailable,
    isEnrolled,
    biometricType,
    isLoading,
    biometricLabel: getBiometricLabel(biometricType),
    authenticate,
    refresh: checkBiometric,
  };
}
