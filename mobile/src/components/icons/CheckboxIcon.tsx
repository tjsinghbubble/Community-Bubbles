import React from 'react';
import Svg, { Rect, Path, Defs, ClipPath, G } from 'react-native-svg';

interface CheckboxIconProps {
  size?: number;
  checked?: boolean;
  borderColor?: string;
  checkColor?: string;
}

const CheckboxIcon: React.FC<CheckboxIconProps> = ({
  size = 18,
  checked = false,
  borderColor = '#4D4D4D',
  checkColor = '#1C1B1F',
}) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Rect x={0.5} y={0.5} width={17} height={17} rx={3.5} stroke={borderColor} />
    {checked && (
      <G>
        <Defs>
          <ClipPath id="clip">
            <Rect width={18} height={18} rx={4} fill="white" />
          </ClipPath>
        </Defs>
        <G clipPath="url(#clip)">
          <Path
            d="M7.1625 13.5003L2.8875 9.22532L3.95625 8.15657L7.1625 11.3628L14.0438 4.48157L15.1125 5.55032L7.1625 13.5003Z"
            fill={checkColor}
          />
        </G>
      </G>
    )}
  </Svg>
);

export default CheckboxIcon;
