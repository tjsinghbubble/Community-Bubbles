import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const clockIcon = require('../assets/icons/clock.png');
const limitIcon = require('../assets/icons/limit.png');

type IconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  tintColor?: string;
};

export function ClockIcon({ size = 24, style, tintColor }: IconProps) {
  return (
    <Image
      source={clockIcon}
      style={[{ width: size, height: size }, tintColor ? { tintColor } : undefined, style]}
      resizeMode="contain"
    />
  );
}

export function LimitIcon({ size = 24, style, tintColor }: IconProps) {
  return (
    <Image
      source={limitIcon}
      style={[{ width: size, height: size }, tintColor ? { tintColor } : undefined, style]}
      resizeMode="contain"
    />
  );
}
