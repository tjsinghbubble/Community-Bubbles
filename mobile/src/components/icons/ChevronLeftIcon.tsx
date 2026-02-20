import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronLeftIconProps {
  size?: number;
  color?: string;
}

const ChevronLeftIcon: React.FC<ChevronLeftIconProps> = ({ size = 24, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15.6538 21.308L6 11.654L15.6538 2L17.073 3.419L8.8382 11.654L17.073 19.888L15.6538 21.308Z"
      fill={color}
    />
  </Svg>
);

export default ChevronLeftIcon;
