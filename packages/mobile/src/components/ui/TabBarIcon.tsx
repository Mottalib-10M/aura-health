/**
 * TabBarIcon
 *
 * SVG-based tab bar icon component. Uses simple path-based SVG icons
 * to avoid external icon library dependencies. Each icon is designed
 * at a 24x24 viewBox and scales to the provided size.
 */

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type IconName = 'home' | 'stethoscope' | 'calendar' | 'heart-pulse' | 'user';

interface TabBarIconProps {
  name: IconName;
  color: string;
  size: number;
}

export function TabBarIcon({ name, color, size }: TabBarIconProps) {
  const iconSize = size || 24;

  switch (name) {
    case 'home':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Home icon">
          <Path
            d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15C15 14.4477 14.5523 14 14 14H10C9.44772 14 9 14.4477 9 15V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'stethoscope':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Triage icon">
          <Path
            d="M6 2V8C6 11.3137 8.68629 14 12 14V14C15.3137 14 18 11.3137 18 8V2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Path
            d="M12 14V17C12 19.2091 10.2091 21 8 21V21C5.79086 21 4 19.2091 4 17V16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx="20" cy="12" r="2" stroke={color} strokeWidth={2} />
          <Path d="M20 14V17C20 19.2091 18.2091 21 16 21V21" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );

    case 'calendar':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Appointments icon">
          <Path
            d="M4 8C4 6.89543 4.89543 6 6 6H18C19.1046 6 20 6.89543 20 8V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V8Z"
            stroke={color}
            strokeWidth={2}
          />
          <Path d="M4 10H20" stroke={color} strokeWidth={2} />
          <Path d="M8 3V7" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M16 3V7" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M8 14H10" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M14 14H16" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M8 17H10" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );

    case 'heart-pulse':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Health data icon">
          <Path
            d="M12 6C12 6 8.5 2 5 4.5C1.5 7 3 11.5 12 20C21 11.5 22.5 7 19 4.5C15.5 2 12 6 12 6Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M4 12H8L10 9L12 15L14 12H20"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'user':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Profile icon">
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
          <Path
            d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20V21H5V20Z"
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      );

    default:
      return null;
  }
}
