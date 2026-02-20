import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export default function MessagesIcon({ size = 24, color = '#6A6A6A' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 22" fill="none">
      <Path
        d="M0.333 21.1666V4.6666C0.333 4.1624 0.513 3.7308 0.872 3.3718C1.231 3.0128 1.663 2.8333 2.167 2.8333H16.833C17.338 2.8333 17.769 3.0128 18.128 3.3718C18.487 3.7308 18.667 4.1624 18.667 4.6666V15.6666C18.667 16.1708 18.487 16.6024 18.128 16.9614C17.769 17.3204 17.338 17.4999 16.833 17.4999H4L0.333 21.1666ZM3.221 15.6666H16.833V4.6666H2.167V16.6978L3.221 15.6666Z"
        fill={color}
      />
    </Svg>
  );
}
