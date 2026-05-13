/**
 * Button Component
 *
 * A versatile, accessible button component supporting multiple visual
 * variants (primary, secondary, outline, ghost, danger) and sizes
 * (sm, md, lg). Includes loading state with ActivityIndicator and
 * disabled styling. All buttons include proper accessibilityRole
 * and accessibilityLabel support.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, Typography, Shadows } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  /** Button text label */
  title: string;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Optional icon element rendered before the title */
  leftIcon?: React.ReactNode;
  /** Optional icon element rendered after the title */
  rightIcon?: React.ReactNode;
  /** Override container style */
  style?: ViewStyle;
  /** Override text style */
  textStyle?: TextStyle;
  /** Full width mode */
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// Style Maps
// ---------------------------------------------------------------------------

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle; pressed: ViewStyle }> = {
  primary: {
    container: {
      backgroundColor: Colors.primary,
      ...Shadows.md,
    },
    text: {
      color: Colors.textInverse,
    },
    pressed: {
      backgroundColor: Colors.primaryDark,
    },
  },
  secondary: {
    container: {
      backgroundColor: Colors.primaryFaded,
    },
    text: {
      color: Colors.primary,
    },
    pressed: {
      backgroundColor: 'rgba(13, 148, 136, 0.2)',
    },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    text: {
      color: Colors.primary,
    },
    pressed: {
      backgroundColor: Colors.primaryFaded,
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: Colors.primary,
    },
    pressed: {
      backgroundColor: Colors.primaryFaded,
    },
  },
  danger: {
    container: {
      backgroundColor: Colors.error,
      ...Shadows.md,
    },
    text: {
      color: Colors.textInverse,
    },
    pressed: {
      backgroundColor: '#DC2626',
    },
  },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      minHeight: 36,
    },
    text: Typography.buttonSm,
  },
  md: {
    container: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      minHeight: 48,
    },
    text: Typography.button,
  },
  lg: {
    container: {
      paddingHorizontal: Spacing.xxl,
      paddingVertical: Spacing.lg,
      borderRadius: Radius.lg,
      minHeight: 56,
    },
    text: {
      ...Typography.button,
      fontSize: 18,
    },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  fullWidth = false,
  accessibilityLabel,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && variantStyle.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.text.color}
          accessibilityLabel="Loading"
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <Text
            style={[
              styles.text,
              sizeStyle.text,
              variantStyle.text,
              isDisabled && styles.disabledText,
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.8,
  },
});
