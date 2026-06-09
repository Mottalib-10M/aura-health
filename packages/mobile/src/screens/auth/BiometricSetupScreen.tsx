/**
 * BiometricSetupScreen
 *
 * Biometric enrollment onboarding flow:
 *   1. Camera view with face overlay guide
 *   2. Liveness detection instructions (blink, turn head, smile)
 *   3. Processing animation
 *   4. Success confirmation with recovery codes
 *   5. "Save recovery codes" warning
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import type { AuthScreenProps } from '../../navigation/types';
import { FaceCapture, type LivenessStep } from '../../components/biometric/FaceCapture';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetupPhase = 'capture' | 'processing' | 'success';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BiometricSetupScreen({
  navigation,
  route,
}: AuthScreenProps<'BiometricSetup'>) {
  const { isOnboarding } = route.params;
  const { enableBiometric } = useAuth();
  const { setBiometricEnabled, setOnboardingComplete } = useAuthStore();

  const [phase, setPhase] = useState<SetupPhase>('capture');
  const [currentStep, setCurrentStep] = useState<LivenessStep>('blink');
  const [completedSteps, setCompletedSteps] = useState<LivenessStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Processing animation
  const rotation = useSharedValue(0);

  const startProcessingAnimation = useCallback(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // ---------------------------------------------------------------------------
  // Liveness Detection Flow
  // ---------------------------------------------------------------------------

  const STEPS_ORDER: LivenessStep[] = ['blink', 'turn_left', 'turn_right', 'smile'];

  const handleCapture = useCallback(async () => {
    setIsProcessing(true);
    setError(undefined);

    // Simulate liveness check processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const nextCompleted = [...completedSteps, currentStep];
    setCompletedSteps(nextCompleted);
    setIsProcessing(false);

    // Move to next step or complete
    const currentIndex = STEPS_ORDER.indexOf(currentStep);
    if (currentIndex < STEPS_ORDER.length - 1) {
      setCurrentStep(STEPS_ORDER[currentIndex + 1]);
    } else {
      // All liveness steps completed - process enrollment
      setPhase('processing');
      startProcessingAnimation();

      try {
        // Simulate server-side biometric enrollment
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Generate recovery codes (in production, these come from the server)
        const codes = Array.from({ length: 8 }, () =>
          Math.random().toString(36).substring(2, 8).toUpperCase()
        );
        setRecoveryCodes(codes);

        // Enable biometric auth
        const biometricToken = `bio_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        await enableBiometric(biometricToken);
        setBiometricEnabled(true);

        setPhase('success');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Enrollment failed. Please try again.'
        );
        setPhase('capture');
        setCompletedSteps([]);
        setCurrentStep('blink');
      }
    }
  }, [
    completedSteps,
    currentStep,
    enableBiometric,
    setBiometricEnabled,
    startProcessingAnimation,
  ]);

  const handleSkip = useCallback(() => {
    if (isOnboarding) {
      setOnboardingComplete(true);
    }
    navigation.goBack();
  }, [isOnboarding, navigation, setOnboardingComplete]);

  const handleCopyRecoveryCodes = useCallback(async () => {
    const codesText = recoveryCodes.join('\n');
    await Clipboard.setStringAsync(codesText);
    Alert.alert('Copied', 'Recovery codes have been copied to your clipboard.');
  }, [recoveryCodes]);

  const handleShareRecoveryCodes = useCallback(async () => {
    const codesText = recoveryCodes.join('  |  ');
    await Share.share({
      message: `Uzavita Recovery Codes:\n\n${codesText}\n\nStore these codes in a safe place. You will need them if you lose access to your biometric login.`,
      title: 'Uzavita Recovery Codes',
    });
  }, [recoveryCodes]);

  const handleDone = useCallback(() => {
    if (!codesAcknowledged) {
      Alert.alert(
        'Save Your Recovery Codes',
        'Please make sure you have saved your recovery codes. You will need them to recover your account if you lose access to biometric login.',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'I Saved Them',
            onPress: () => {
              setCodesAcknowledged(true);
              if (isOnboarding) {
                setOnboardingComplete(true);
              }
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    if (isOnboarding) {
      setOnboardingComplete(true);
    }
    navigation.goBack();
  }, [codesAcknowledged, isOnboarding, navigation, setOnboardingComplete]);

  // ---------------------------------------------------------------------------
  // Render: Processing Phase
  // ---------------------------------------------------------------------------

  if (phase === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.processingContainer}>
          <Animated.View style={[styles.processingSpinner, spinStyle]}>
            <Svg width={80} height={80} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Processing">
              <Circle
                cx={12}
                cy={12}
                r={10}
                stroke={Colors.primaryFaded}
                strokeWidth={3}
              />
              <Path
                d="M12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893"
                stroke={Colors.primary}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>

          <Text style={styles.processingTitle}>Setting Up Biometrics</Text>
          <Text style={styles.processingSubtitle}>
            Encrypting and securely storing your biometric template...
          </Text>

          <View style={styles.processingSteps}>
            <ProcessingStepItem label="Capturing facial features" done />
            <ProcessingStepItem label="Verifying liveness" done />
            <ProcessingStepItem label="Encrypting biometric template" active />
            <ProcessingStepItem label="Generating recovery codes" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Success Phase
  // ---------------------------------------------------------------------------

  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          {/* Success icon */}
          <View style={styles.successIcon}>
            <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Setup complete">
              <Circle cx={12} cy={12} r={10} fill={Colors.successLight} />
              <Path
                d="M8 12L11 15L16 9"
                stroke={Colors.success}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={styles.successTitle}>Biometric Setup Complete</Text>
          <Text style={styles.successSubtitle}>
            You can now log in securely using facial recognition.
          </Text>

          {/* Recovery codes */}
          <View style={styles.recoverySection}>
            <View style={styles.recoveryWarning}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 9V13M12 17H12.01M4.93 19H19.07C20.44 19 21.33 17.53 20.65 16.35L13.58 3.71C12.9 2.53 11.1 2.53 10.42 3.71L3.35 16.35C2.67 17.53 3.56 19 4.93 19Z"
                  stroke={Colors.warning}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.recoveryWarningText}>
                Save these recovery codes in a safe place. You will need them
                to regain access if you lose your device.
              </Text>
            </View>

            <View style={styles.codesGrid}>
              {recoveryCodes.map((code, index) => (
                <View key={code} style={styles.codeItem}>
                  <Text style={styles.codeIndex}>{index + 1}.</Text>
                  <Text
                    style={styles.codeText}
                    selectable
                    accessibilityLabel={`Recovery code ${index + 1}: ${code}`}
                  >
                    {code}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.codeActions}>
              <Button
                title="Copy Codes"
                variant="outline"
                size="sm"
                onPress={handleCopyRecoveryCodes}
                accessibilityLabel="Copy recovery codes to clipboard"
              />
              <Button
                title="Share"
                variant="outline"
                size="sm"
                onPress={handleShareRecoveryCodes}
                accessibilityLabel="Share recovery codes"
              />
            </View>
          </View>

          {/* Acknowledgment checkbox */}
          <Pressable
            style={styles.acknowledgeRow}
            onPress={() => setCodesAcknowledged(!codesAcknowledged)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: codesAcknowledged }}
            accessibilityLabel="I have saved my recovery codes"
          >
            <View
              style={[
                styles.checkbox,
                codesAcknowledged && styles.checkboxChecked,
              ]}
            >
              {codesAcknowledged && (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12L10 17L20 7"
                    stroke={Colors.white}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </View>
            <Text style={styles.acknowledgeText}>
              I have saved my recovery codes
            </Text>
          </Pressable>

          <Button
            title="Done"
            onPress={handleDone}
            fullWidth
            size="lg"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Capture Phase (default)
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <FaceCapture
        currentStep={currentStep}
        completedSteps={completedSteps}
        isProcessing={isProcessing}
        onCapture={handleCapture}
        onSkip={isOnboarding ? handleSkip : undefined}
        error={error}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Processing Step Item
// ---------------------------------------------------------------------------

function ProcessingStepItem({
  label,
  done = false,
  active = false,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={processingItemStyles.container} accessibilityLabel={`${label}: ${done ? 'completed' : active ? 'in progress' : 'pending'}`}>
      {done ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} fill={Colors.successLight} />
          <Path d="M8 12L11 15L16 9" stroke={Colors.success} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      ) : active ? (
        <ActivityIndicator size={16} color={Colors.primary} />
      ) : (
        <View style={processingItemStyles.pendingDot} />
      )}
      <Text
        style={[
          processingItemStyles.label,
          done && processingItemStyles.labelDone,
          active && processingItemStyles.labelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const processingItemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pendingDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
  },
  label: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
  },
  labelDone: {
    color: Colors.success,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  processingSpinner: {
    marginBottom: Spacing.xxl,
  },
  processingTitle: {
    ...Typography.h3,
    color: Colors.darkBlue,
    marginBottom: Spacing.sm,
  },
  processingSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  processingSteps: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.xxl,
  },
  successContainer: {
    flex: 1,
    padding: Spacing.xxl,
    paddingTop: Spacing.xxxxl,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.darkBlue,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  recoverySection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  recoveryWarning: {
    flexDirection: 'row',
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  recoveryWarningText: {
    ...Typography.bodySm,
    color: Colors.gray700,
    flex: 1,
    lineHeight: 20,
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  codeIndex: {
    ...Typography.caption,
    color: Colors.textTertiary,
    width: 20,
  },
  codeText: {
    ...Typography.bodySmMedium,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  acknowledgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  acknowledgeText: {
    ...Typography.bodySm,
    color: Colors.textPrimary,
    flex: 1,
  },
});
