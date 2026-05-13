/**
 * Card Component
 *
 * A surface container with configurable elevation (shadow), rounded
 * corners, and an optional pressable mode for interactive cards.
 * Used throughout the app for dashboard tiles, appointment cards,
 * health metric summaries, and triage result panels.
 */

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardElevation = 'none' | 'sm' | 'md' | 'lg';

interface CardBaseProps {
  /** Child elements */
  children: React.ReactNode;
  /** Shadow elevation level */
  elevation?: CardElevation;
  /** Override container style */
  style?: ViewStyle;
  /** Remove default padding */
  noPadding?: boolean;
  /** Border radius preset */
  radius?: keyof typeof Radius;
}

interface PressableCardProps extends CardBaseProps, Omit<PressableProps, 'style'> {
  /** Makes the card respond to press events */
  pressable: true;
}

interface StaticCardProps extends CardBaseProps {
  pressable?: false;
}

type CardProps = PressableCardProps | StaticCardProps;

// ---------------------------------------------------------------------------
// Elevation Map
// ---------------------------------------------------------------------------

const elevationMap: Record<CardElevation, ViewStyle> = {
  none: {},
  sm: Shadows.sm,
  md: Shadows.md,
  lg: Shadows.lg,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Card(props: CardProps) {
  const {
    children,
    elevation = 'md',
    style,
    noPadding = false,
    radius = 'lg',
  } = props;

  const containerStyle: ViewStyle[] = [
    styles.base,
    { borderRadius: Radius[radius] },
    elevationMap[elevation],
    !noPadding && styles.padding,
    style as ViewStyle,
  ];

  if (props.pressable) {
    const {
      pressable: _pressable,
      children: _children,
      elevation: _elevation,
      style: _style,
      noPadding: _noPadding,
      radius: _radius,
      ...pressableProps
    } = props;

    return (
      <Pressable
        {...pressableProps}
        accessibilityRole="button"
        style={({ pressed }) => [
          ...containerStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  padding: {
    padding: Spacing.lg,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
});
