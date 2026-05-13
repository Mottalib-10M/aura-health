/**
 * BottomSheet Component
 *
 * A modal bottom sheet built with react-native-gesture-handler and
 * react-native-reanimated. Supports drag-to-dismiss, backdrop tap
 * to close, snap points, and dynamic content sizing. Used for
 * country code selectors, language pickers, filter panels, and
 * confirmation dialogs throughout the app.
 */

import React, { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  type ViewStyle,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Radius, Spacing, Shadows, Typography } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.9;

export interface BottomSheetRef {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

interface BottomSheetProps {
  /** Child content rendered inside the sheet */
  children: React.ReactNode;
  /** Optional title displayed at the top of the sheet */
  title?: string;
  /** Height as a fraction of screen height (0-1). Default: 0.5 */
  snapPoint?: number;
  /** Called when the sheet is fully closed */
  onClose?: () => void;
  /** Override container style */
  style?: ViewStyle;
  /** Show a drag handle indicator */
  showHandle?: boolean;
  /** Enable backdrop press to close */
  closeOnBackdrop?: boolean;
}

// ---------------------------------------------------------------------------
// Spring Config
// ---------------------------------------------------------------------------

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet(
    {
      children,
      title,
      snapPoint = 0.5,
      onClose,
      style,
      showHandle = true,
      closeOnBackdrop = true,
    },
    ref
  ) {
    const translateY = useSharedValue(0);
    const active = useSharedValue(false);
    const context = useSharedValue({ y: 0 });

    const openPosition = -SCREEN_HEIGHT * snapPoint;

    const scrollTo = useCallback(
      (destination: number) => {
        'worklet';
        translateY.value = withSpring(destination, SPRING_CONFIG);
        active.value = destination !== 0;
      },
      [active, translateY]
    );

    const handleClose = useCallback(() => {
      scrollTo(0);
      if (onClose) {
        setTimeout(onClose, 300);
      }
    }, [scrollTo, onClose]);

    const handleOpen = useCallback(() => {
      scrollTo(openPosition);
    }, [scrollTo, openPosition]);

    const isOpen = useCallback(() => {
      return active.value;
    }, [active]);

    useImperativeHandle(ref, () => ({
      open: handleOpen,
      close: handleClose,
      isOpen,
    }));

    // Handle Android back button
    useEffect(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (active.value) {
            handleClose();
            return true;
          }
          return false;
        }
      );
      return () => subscription.remove();
    }, [active, handleClose]);

    // Pan gesture for drag-to-dismiss
    const gesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event) => {
        translateY.value = Math.max(
          event.translationY + context.value.y,
          MAX_TRANSLATE_Y
        );
        // Only allow dragging down from current position
        translateY.value = Math.min(translateY.value, 0);
      })
      .onEnd((event) => {
        // If dragged down past 1/3 of open height, close
        if (translateY.value > openPosition / 3) {
          scrollTo(0);
          if (onClose) {
            runOnJS(onClose)();
          }
        } else if (event.velocityY > 500) {
          // Fast fling down = close
          scrollTo(0);
          if (onClose) {
            runOnJS(onClose)();
          }
        } else {
          scrollTo(openPosition);
        }
      });

    // Animated styles
    const sheetAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        translateY.value,
        [0, openPosition],
        [0, 0.5],
        Extrapolation.CLAMP
      ),
      pointerEvents: translateY.value < -10 ? 'auto' as const : 'none' as const,
    }));

    return (
      <>
        {/* Backdrop overlay */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeOnBackdrop ? handleClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close bottom sheet"
          />
        </Animated.View>

        {/* Sheet container */}
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[styles.sheet, sheetAnimatedStyle, style]}
            accessibilityRole="dialog"
            accessibilityLabel={title || 'Bottom sheet'}
          >
            {/* Drag handle */}
            {showHandle && (
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
            )}

            {/* Title */}
            {title && (
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
              </View>
            )}

            {/* Content */}
            <View style={styles.content}>{children}</View>
          </Animated.View>
        </GestureDetector>
      </>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    zIndex: 100,
  },
  sheet: {
    position: 'absolute',
    top: SCREEN_HEIGHT,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    zIndex: 101,
    ...Shadows.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.gray300,
    borderRadius: Radius.full,
  },
  titleContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});
