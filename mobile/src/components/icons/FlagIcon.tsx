import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FlagIconProps {
  size?: number;
  color?: string;
}

const FlagIcon: React.FC<FlagIconProps> = ({ size = 24, color = '#FF3B30' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5.5 22.5V4.5H20.5L18.452 9.135L20.5 13.769H7V22.5H5.5ZM7 12.269H18.2327L16.8212 9.135L18.2327 6H7V12.269Z"
      fill={color}
    />
  </Svg>
);

export default FlagIcon;
