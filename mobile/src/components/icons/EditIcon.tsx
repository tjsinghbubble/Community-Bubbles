import React from 'react';
import Svg, { Mask, Rect, G, Path } from 'react-native-svg';

interface EditIconProps {
  size?: number;
  color?: string;
}

const EditIcon: React.FC<EditIconProps> = ({ size = 24, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Mask id="mask0_edit" maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
      <Rect width={24} height={24} fill="#D9D9D9" />
    </Mask>
    <G mask="url(#mask0_edit)">
      <Path
        d="M5 19H6.2615L16.498 8.7635L15.2365 7.502L5 17.7385V19ZM3.5 20.5V17.1155L16.6905 3.93075C16.8417 3.79342 17.0086 3.68733 17.1913 3.6125C17.3741 3.5375 17.5658 3.5 17.7663 3.5C17.9668 3.5 18.1609 3.53558 18.3488 3.60675C18.5367 3.67792 18.7032 3.79108 18.848 3.94625L20.0693 5.18275C20.2244 5.32758 20.335 5.49425 20.401 5.68275C20.467 5.87125 20.5 6.05975 20.5 6.24825C20.5 6.44942 20.4657 6.64133 20.397 6.824C20.3283 7.00683 20.2191 7.17383 20.0693 7.325L6.8845 20.5H3.5ZM15.8562 8.14375L15.2365 7.502L16.498 8.7635L15.8562 8.14375Z"
        fill={color}
      />
    </G>
  </Svg>
);

export default EditIcon;
