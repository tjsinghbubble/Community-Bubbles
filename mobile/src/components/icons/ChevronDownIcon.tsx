import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronDownIconProps {
  size?: number;
  color?: string;
}

const ChevronDownIcon: React.FC<ChevronDownIconProps> = ({ size = 24, color = '#1C1B1F' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.654 7L12 16.6537L2.346 7L3.765 5.5807L12 13.8155L20.234 5.5807L21.654 7Z"
      fill={color}
    />
  </Svg>
);

export default ChevronDownIcon;
