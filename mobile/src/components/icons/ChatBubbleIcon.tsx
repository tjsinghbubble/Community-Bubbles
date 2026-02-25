import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChatBubbleIconProps {
  size?: number;
  color?: string;
}

const ChatBubbleIcon: React.FC<ChatBubbleIconProps> = ({ size = 24, color = '#4D4D4D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6.25 13.75H13.75V12.25H6.25V13.75ZM6.25 10.75H17.75V9.25H6.25V10.75ZM6.25 7.75H17.75V6.25H6.25V7.75ZM2.5 21.038V4.3077C2.5 3.8026 2.675 3.375 3.025 3.025C3.375 2.675 3.8026 2.5 4.3077 2.5H19.6923C20.1974 2.5 20.625 2.675 20.975 3.025C21.325 3.375 21.5 3.8026 21.5 4.3077V15.692C21.5 16.197 21.325 16.625 20.975 16.975C20.625 17.325 20.1974 17.5 19.6923 17.5H6.0385L2.5 21.038ZM5.4 16H19.6923C19.7693 16 19.8398 15.968 19.9038 15.904C19.9679 15.84 20 15.769 20 15.692V4.3077C20 4.2307 19.9679 4.1602 19.9038 4.0962C19.8398 4.0321 19.7693 4 19.6923 4H4.3077C4.2307 4 4.1603 4.0321 4.0963 4.0962C4.0321 4.1602 4 4.2307 4 4.3077V17.385L5.4 16Z"
      fill={color}
    />
  </Svg>
);

export default ChatBubbleIcon;
