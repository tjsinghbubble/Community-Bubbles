import React from 'react';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

interface ReactionFaceIconProps {
  size?: number;
  color?: string;
}

const ReactionFaceIcon: React.FC<ReactionFaceIconProps> = ({ size = 24, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="12" r="8.5" stroke={color} strokeWidth={1.5} />
    <Circle cx="8.5" cy="10" r="1" fill={color} />
    <Circle cx="13.5" cy="10" r="1" fill={color} />
    <Path
      d="M7.5 14.5C8.2 15.9 9.5 16.5 11 16.5C12.5 16.5 13.8 15.9 14.5 14.5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <SvgText
      x="19.5"
      y="7"
      fontSize="10"
      fontWeight="700"
      fill={color}
      textAnchor="middle"
    >+</SvgText>
  </Svg>
);

export default ReactionFaceIcon;
