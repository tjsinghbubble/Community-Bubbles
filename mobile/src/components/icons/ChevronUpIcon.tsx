import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronUpIconProps {
  size?: number;
  color?: string;
}

const ChevronUpIcon: React.FC<ChevronUpIconProps> = ({ size = 24, color = '#1C1B1F' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2.346 17L12 7.3463L21.654 17L20.234 18.4193L12 10.1845L3.765 18.4193L2.346 17Z"
      fill={color}
    />
  </Svg>
);

export default ChevronUpIcon;
