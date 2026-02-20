import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface PlusIconProps {
  size?: number;
  color?: string;
}

const PlusIcon: React.FC<PlusIconProps> = ({ size = 20, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <Path
      d="M9.4551 17.685V10.73H2.5V9.384H9.4551V2.429H10.8013V9.384H17.7564V10.73H10.8013V17.685H9.4551Z"
      fill={color}
    />
  </Svg>
);

export default PlusIcon;
