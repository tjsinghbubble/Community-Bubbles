import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronRightIconProps {
  size?: number;
  color?: string;
}

const ChevronRightIcon: React.FC<ChevronRightIconProps> = ({ size = 24, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8.0154 21.654L6.5962 20.235L14.8307 12L6.5962 3.766L8.0154 2.347L17.6692 12L8.0154 21.654Z"
      fill={color}
    />
  </Svg>
);

export default ChevronRightIcon;
