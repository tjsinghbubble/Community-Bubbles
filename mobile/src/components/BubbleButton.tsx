import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import Svg, {
  Rect,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { Colors, Typography, Spacing } from '../styles/theme';

export type BubbleButtonVariant =
  | 'primary'
  | 'outline'
  | 'destructive'
  | 'ghost';

interface BubbleButtonProps {
  title: string;
  onPress: () => void;
  variant?: BubbleButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  testID?: string;
}

function ButtonSvgDefault() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="grad_default" x1="7.77313e-06" y1="0.0833303" x2="105.144" y2="267.375" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#35A8F7" />
          <Stop offset="1" stopColor="white" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="313" height="56" rx="28" fill="url(#grad_default)" />
    </Svg>
  );
}

function ButtonSvgPressed() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect width="313" height="56" rx="28" fill="#37ADFF" />
    </Svg>
  );
}

function ButtonSvgDisabled() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect width="313" height="56" rx="28" fill="#969696" />
    </Svg>
  );
}

function ButtonSvgOutlined() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#35A8F7" fill="none" />
    </Svg>
  );
}

function ButtonSvgOutlinedPressed() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" fill="#35A8F7" fillOpacity={0.15} />
      <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#35A8F7" fill="none" />
    </Svg>
  );
}

function ButtonSvgOutlinedDisabled() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#98B4C8" fill="none" />
    </Svg>
  );
}

function ButtonSvgRedOutline() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#FF3B30" fill="none" />
    </Svg>
  );
}

function getSvgBackground(
  variant: BubbleButtonVariant,
  pressed: boolean,
  isDisabled: boolean,
): React.ReactNode {
  if (variant === 'primary') {
    if (isDisabled) return <ButtonSvgDisabled />;
    if (pressed) return <ButtonSvgPressed />;
    return <ButtonSvgDefault />;
  }
  if (variant === 'outline') {
    if (isDisabled) return <ButtonSvgOutlinedDisabled />;
    if (pressed) return <ButtonSvgOutlinedPressed />;
    return <ButtonSvgOutlined />;
  }
  if (variant === 'destructive') {
    if (pressed) {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" fill="#FF3B30" fillOpacity={0.1} />
          <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#FF3B30" fill="none" />
        </Svg>
      );
    }
    return <ButtonSvgRedOutline />;
  }
  if (variant === 'ghost') {
    if (pressed) {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 313 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" fill="#35A8F7" fillOpacity={0.08} />
          <Rect x="0.5" y="0.5" width="312" height="55" rx="27.5" stroke="#98B4C8" fill="none" />
        </Svg>
      );
    }
    return <ButtonSvgOutlinedDisabled />;
  }
  return <ButtonSvgDefault />;
}

export default function BubbleButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  testID,
}: BubbleButtonProps) {
  const isDisabled = disabled || loading;

  const getTextColor = (): string => {
    if (variant === 'primary') return '#FFFFFF';
    if (variant === 'outline') return isDisabled ? '#98B4C8' : Colors.brand.primary;
    if (variant === 'destructive') return '#FF3B30';
    if (variant === 'ghost') return '#98B4C8';
    return '#FFFFFF';
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={[styles.wrapper, style]}
    >
      {({ pressed }) => (
        <>
          {getSvgBackground(variant, pressed, isDisabled)}
          {loading ? (
            <ActivityIndicator
              color={variant === 'primary' ? '#FFFFFF' : Colors.brand.primary}
              size="small"
            />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text
                style={[
                  styles.text,
                  { color: getTextColor() },
                  textStyle,
                ]}
              >
                {title}
              </Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 1,
  },
  iconWrap: {
    marginRight: 2,
  },
  text: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as TextStyle['fontWeight'],
    letterSpacing: -0.3,
  },
});
