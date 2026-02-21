import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';

type AnimatedPressableProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  children: React.ReactNode;
};

export default function AnimatedPressable({
  style,
  scaleValue = 0.97,
  onPress,
  children,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
