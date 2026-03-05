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
import { Typography, Spacing } from '../styles/theme';
import { ButtonSvgTokens } from '../styles/design-tokens';

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

const B = ButtonSvgTokens;
const VB = `0 0 313 ${B.height}`;
const OR = B.outlineBorderRadius;

function ButtonSvgDefault() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="grad_default" x1="7.77313e-06" y1="0.0833303" x2="105.144" y2="267.375" gradientUnits="userSpaceOnUse">
          <Stop stopColor={B.primary.gradient.start} />
          <Stop offset="1" stopColor={B.primary.gradient.end} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="313" height={B.height} rx={B.borderRadius} fill="url(#grad_default)" />
    </Svg>
  );
}

function ButtonSvgPressed() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect width="313" height={B.height} rx={B.borderRadius} fill={B.primary.pressed} />
    </Svg>
  );
}

function ButtonSvgDisabled() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect width="313" height={B.height} rx={B.borderRadius} fill={B.primary.disabled} />
    </Svg>
  );
}

function ButtonSvgOutlined() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.outline.stroke} fill="none" />
    </Svg>
  );
}

function ButtonSvgOutlinedPressed() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} fill={B.outline.stroke} fillOpacity={B.outline.pressedFillOpacity} />
      <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.outline.stroke} fill="none" />
    </Svg>
  );
}

function ButtonSvgOutlinedDisabled() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.outline.disabledStroke} fill="none" />
    </Svg>
  );
}

function ButtonSvgRedOutline() {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.destructive.stroke} fill="none" />
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
        <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} fill={B.destructive.stroke} fillOpacity={B.destructive.pressedFillOpacity} />
          <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.destructive.stroke} fill="none" />
        </Svg>
      );
    }
    return <ButtonSvgRedOutline />;
  }
  if (variant === 'ghost') {
    if (pressed) {
      return (
        <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} fill={B.ghost.pressedFillColor} fillOpacity={B.ghost.pressedFillOpacity} />
          <Rect x="0.5" y="0.5" width="312" height="55" rx={OR} stroke={B.ghost.stroke} fill="none" />
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
    if (variant === 'primary') return B.primary.text;
    if (variant === 'outline') return isDisabled ? B.outline.disabledText : B.outline.text;
    if (variant === 'destructive') return B.destructive.text;
    if (variant === 'ghost') return B.ghost.text;
    return B.primary.text;
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
              color={variant === 'primary' ? B.primary.text : B.outline.text}
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
    height: B.height,
    borderRadius: B.borderRadius,
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
