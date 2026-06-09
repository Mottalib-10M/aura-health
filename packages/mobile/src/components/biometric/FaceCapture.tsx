/**
 * FaceCapture Component
 *
 * Camera view for biometric face enrollment with overlay guide and
 * liveness detection UI. Displays instruction text (blink, turn head,
 * smile) with progress indicators as the user completes each liveness
 * check. Uses expo-camera for the camera feed.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Defs, Mask, Rect } from 'react-native-svg';
import { Colors, Spacing, Typography, Radius } from '../../utils/formatters';
import { Button } from '../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LivenessStep = 'blink' | 'turn_left' | 'turn_right' | 'smile';

interface FaceCaptureProps {
  /** Currently active liveness check step */
  currentStep: LivenessStep;
  /** Steps that have been completed */
  completedSteps: LivenessStep[];
  /** Whether the camera is currently processing a frame */
  isProcessing: boolean;
  /** Called when the user manually triggers a capture (fallback) */
  onCapture: () => void;
  /** Called when the user requests to skip liveness (if allowed) */
  onSkip?: () => void;
  /** Error message to display */
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.65;
const OVAL_HEIGHT = OVAL_WIDTH * 1.35;

const LIVENESS_STEPS: { key: LivenessStep; label: string; instruction: string }[] = [
  { key: 'blink', label: 'Blink', instruction: 'Please blink your eyes naturally' },
  { key: 'turn_left', label: 'Turn Left', instruction: 'Slowly turn your head to the left' },
  { key: 'turn_right', label: 'Turn Right', instruction: 'Slowly turn your head to the right' },
  { key: 'smile', label: 'Smile', instruction: 'Smile for the camera' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FaceCapture({
  currentStep,
  completedSteps,
  isProcessing,
  onCapture,
  onSkip,
  error,
}: FaceCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  const pulseScale = useSharedValue(1);

  // Pulse animation for the oval guide
  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const currentStepInfo = LIVENESS_STEPS.find((s) => s.key === currentStep);

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.permissionText}>Checking camera permissions...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Uzavita needs camera access for biometric enrollment.
          This ensures your identity is securely verified.
        </Text>
        <Button
          title="Grant Camera Access"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera preview */}
      <CameraView
        style={styles.camera}
        facing="front"
        onCameraReady={handleCameraReady}
      >
        {/* Face overlay guide */}
        <View style={styles.overlay}>
          <Animated.View style={[styles.ovalContainer, pulseStyle]}>
            <Svg
              width={SCREEN_WIDTH}
              height={OVAL_HEIGHT + 40}
              viewBox={`0 0 ${SCREEN_WIDTH} ${OVAL_HEIGHT + 40}`}
              accessibilityRole="image"
              accessibilityLabel="Face positioning guide"
            >
              <Defs>
                <Mask id="mask">
                  <Rect width={SCREEN_WIDTH} height={OVAL_HEIGHT + 40} fill="white" />
                  <Ellipse
                    cx={SCREEN_WIDTH / 2}
                    cy={(OVAL_HEIGHT + 40) / 2}
                    rx={OVAL_WIDTH / 2}
                    ry={OVAL_HEIGHT / 2}
                    fill="black"
                  />
                </Mask>
              </Defs>

              {/* Semi-transparent overlay outside the oval */}
              <Rect
                width={SCREEN_WIDTH}
                height={OVAL_HEIGHT + 40}
                fill="rgba(0,0,0,0.6)"
                mask="url(#mask)"
              />

              {/* Oval border */}
              <Ellipse
                cx={SCREEN_WIDTH / 2}
                cy={(OVAL_HEIGHT + 40) / 2}
                rx={OVAL_WIDTH / 2}
                ry={OVAL_HEIGHT / 2}
                fill="none"
                stroke={isProcessing ? Colors.warning : Colors.primary}
                strokeWidth={3}
                strokeDasharray={isProcessing ? '8,8' : '0'}
              />
            </Svg>
          </Animated.View>

          {/* Instruction text */}
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              {currentStepInfo?.instruction || 'Position your face within the oval'}
            </Text>
          </View>
        </View>
      </CameraView>

      {/* Progress dots */}
      <View style={styles.progressContainer}>
        <View style={styles.progressDots}>
          {LIVENESS_STEPS.map((step) => {
            const isCompleted = completedSteps.includes(step.key);
            const isCurrent = step.key === currentStep;
            return (
              <View key={step.key} style={styles.progressItem}>
                <View
                  style={[
                    styles.dot,
                    isCompleted && styles.dotCompleted,
                    isCurrent && styles.dotCurrent,
                  ]}
                  accessibilityRole="progressbar"
                  accessibilityLabel={`${step.label}: ${isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}`}
                />
                <Text
                  style={[
                    styles.dotLabel,
                    isCompleted && styles.dotLabelCompleted,
                    isCurrent && styles.dotLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {cameraReady && !isProcessing && (
          <Button
            title="Capture"
            onPress={onCapture}
            variant="primary"
            size="lg"
            fullWidth
            accessibilityLabel="Capture face image"
          />
        )}
        {onSkip && (
          <Button
            title="Skip for now"
            onPress={onSkip}
            variant="ghost"
            size="sm"
            style={styles.skipButton}
            accessibilityLabel="Skip biometric setup"
          />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray900,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.xxl,
    right: Spacing.xxl,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  instructionText: {
    ...Typography.bodyMedium,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  progressContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  progressItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray300,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  dotCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  dotCurrent: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  dotLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  dotLabelCompleted: {
    color: Colors.success,
  },
  dotLabelCurrent: {
    color: Colors.primary,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  errorText: {
    ...Typography.bodySm,
    color: Colors.error,
    textAlign: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  processingText: {
    ...Typography.bodySmMedium,
    color: Colors.primary,
  },
  actions: {
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  skipButton: {
    marginTop: Spacing.xs,
  },
  permissionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: 24,
  },
  permissionButton: {
    minWidth: 200,
  },
});
