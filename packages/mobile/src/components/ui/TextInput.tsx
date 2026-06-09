/**
 * TextInput Component
 *
 * A styled text input with floating label behavior, error state display,
 * optional leading/trailing icon support, and accessibility annotations.
 * Integrates with the Uzavita design system color tokens.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  /** Field label displayed above the input */
  label: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (hidden when error is present) */
  helperText?: string;
  /** Icon element rendered at the start of the input */
  leftIcon?: React.ReactNode;
  /** Icon element rendered at the end of the input */
  rightIcon?: React.ReactNode;
  /** Callback fired when the right icon is pressed */
  onRightIconPress?: () => void;
  /** Override container style */
  containerStyle?: ViewStyle;
  /** Override input container style */
  inputContainerStyle?: ViewStyle;
  /** Whether the input is required */
  required?: boolean;
  /** Disable the input */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TextInput({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputContainerStyle,
  required = false,
  disabled = false,
  value,
  onFocus,
  onBlur,
  ...inputProps
}: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = useSharedValue(Colors.border);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      borderColor.value = withTiming(
        error ? Colors.error : Colors.primary,
        { duration: 150 }
      );
      onFocus?.(e);
    },
    [borderColor, error, onFocus]
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      borderColor.value = withTiming(
        error ? Colors.error : Colors.border,
        { duration: 150 }
      );
      onBlur?.(e);
    },
    [borderColor, error, onBlur]
  );

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
  }));

  const hasError = Boolean(error);
  const staticBorderColor = hasError
    ? Colors.error
    : isFocused
    ? Colors.primary
    : Colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text
          style={[
            styles.label,
            isFocused && styles.labelFocused,
            hasError && styles.labelError,
          ]}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      {/* Input container */}
      <Animated.View
        style={[
          styles.inputContainer,
          { borderColor: staticBorderColor },
          isFocused && styles.inputContainerFocused,
          hasError && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
          animatedBorderStyle,
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <RNTextInput
          {...inputProps}
          value={value}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon ? styles.inputWithRightIcon : null,
            disabled && styles.inputDisabled,
          ]}
          placeholderTextColor={Colors.textTertiary}
          selectionColor={Colors.primary}
          accessibilityLabel={label}
          accessibilityRole="text"
          accessibilityState={{ disabled }}
        />

        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIcon}
            accessibilityRole="button"
            accessibilityLabel={`${label} action`}
          >
            {rightIcon}
          </Pressable>
        )}
      </Animated.View>

      {/* Error or helper text */}
      {hasError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.bodySmMedium,
    color: Colors.textSecondary,
  },
  labelFocused: {
    color: Colors.primary,
  },
  labelError: {
    color: Colors.error,
  },
  required: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  inputContainerFocused: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
  },
  inputContainerError: {
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
  },
  inputContainerDisabled: {
    backgroundColor: Colors.gray100,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.xs,
  },
  inputDisabled: {
    color: Colors.textTertiary,
  },
  leftIcon: {
    paddingLeft: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    paddingRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.xxs,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.xxs,
  },
});
