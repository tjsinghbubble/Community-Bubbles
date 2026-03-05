import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export default function MessagesIcon({ size = 24, color = '#4D4D4D' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 19 18.54" fill="none">
      <Path
        d="M2.9 13.5H17.192C17.269 13.5 17.34 13.4679 17.404 13.4038C17.468 13.3398 17.5 13.2692 17.5 13.1923V1.8077C17.5 1.7307 17.468 1.6602 17.404 1.5962C17.34 1.5321 17.269 1.5 17.192 1.5H1.808C1.731 1.5 1.66 1.5321 1.596 1.5962C1.532 1.6602 1.5 1.7307 1.5 1.8077V14.8848L2.9 13.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
