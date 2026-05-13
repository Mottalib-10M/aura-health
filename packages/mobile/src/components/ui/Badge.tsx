/**
 * Badge Component
 *
 * Displays urgency level, status, and categorical labels with
 * color-coded backgrounds. Primarily used for triage urgency levels,
 * appointment statuses, and device connection states.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import type { UrgencyLevel } from '@aura/shared/types/triage';
import type { AppointmentStatus } from '@aura/shared/types/appointment';
import {
  Colors,
  Radius,
  Spacing,
  Typography,
  urgencyColorMap,
  urgencyBackgroundMap,
  urgencyLabelMap,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeSize = 'sm' | 'md';

interface BaseBadgeProps {
  /** Override container style */
  style?: ViewStyle;
  /** Override text style */
  textStyle?: TextStyle;
  /** Size variant */
  size?: BadgeSize;
}

interface UrgencyBadgeProps extends BaseBadgeProps {
  /** Display an urgency level badge */
  urgency: UrgencyLevel;
  label?: never;
  color?: never;
  backgroundColor?: never;
}

interface StatusBadgeProps extends BaseBadgeProps {
  /** Display an appointment status badge */
  status: AppointmentStatus;
  label?: never;
  color?: never;
  backgroundColor?: never;
  urgency?: never;
}

interface CustomBadgeProps extends BaseBadgeProps {
  /** Custom label text */
  label: string;
  /** Custom text color */
  color: string;
  /** Custom background color */
  backgroundColor: string;
  urgency?: never;
  status?: never;
}

type BadgeProps = UrgencyBadgeProps | StatusBadgeProps | CustomBadgeProps;

// ---------------------------------------------------------------------------
// Status Color Mapping
// ---------------------------------------------------------------------------

const statusColorMap: Record<AppointmentStatus, { bg: string; text: string }> = {
  scheduled: { bg: Colors.infoLight, text: Colors.info },
  confirmed: { bg: Colors.successLight, text: Colors.success },
  checked_in: { bg: '#ECFDF5', text: '#059669' },
  in_progress: { bg: Colors.primaryFaded, text: Colors.primary },
  completed: { bg: Colors.gray100, text: Colors.gray600 },
  cancelled: { bg: Colors.errorLight, text: Colors.error },
  no_show: { bg: Colors.warningLight, text: Colors.warning },
  rescheduled: { bg: '#FFF7ED', text: '#C2410C' },
};

const statusLabelMap: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  rescheduled: 'Rescheduled',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Badge(props: BadgeProps) {
  const { style, textStyle, size = 'md' } = props;

  let badgeLabel: string;
  let badgeColor: string;
  let badgeBg: string;

  if ('urgency' in props && props.urgency) {
    badgeLabel = urgencyLabelMap[props.urgency];
    badgeColor = urgencyColorMap[props.urgency];
    badgeBg = urgencyBackgroundMap[props.urgency];
  } else if ('status' in props && props.status) {
    const statusColors = statusColorMap[props.status];
    badgeLabel = statusLabelMap[props.status];
    badgeColor = statusColors.text;
    badgeBg = statusColors.bg;
  } else if ('label' in props) {
    badgeLabel = props.label;
    badgeColor = props.color;
    badgeBg = props.backgroundColor;
  } else {
    return null;
  }

  const sizeStyle = size === 'sm' ? styles.containerSm : styles.containerMd;
  const textSizeStyle = size === 'sm' ? styles.textSm : styles.textMd;

  return (
    <View
      style={[
        styles.base,
        sizeStyle,
        { backgroundColor: badgeBg },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={badgeLabel}
    >
      <Text
        style={[
          styles.text,
          textSizeStyle,
          { color: badgeColor },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {badgeLabel}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  containerSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  containerMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    ...Typography.overline,
    fontSize: 9,
  },
  textMd: {
    ...Typography.captionMedium,
    fontSize: 11,
  },
});
