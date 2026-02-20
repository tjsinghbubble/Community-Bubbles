import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface RadioIconProps {
  size?: number;
  selected?: boolean;
  active?: boolean;
}

const RadioIcon: React.FC<RadioIconProps> = ({ size = 20, selected = false, active = true }) => {
  const color = active ? '#35A8F7' : '#969696';

  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={9} stroke={color} strokeWidth={2} />
      {selected && <Circle cx={10} cy={10} r={5} fill={color} />}
    </Svg>
  );
};

export default RadioIcon;
