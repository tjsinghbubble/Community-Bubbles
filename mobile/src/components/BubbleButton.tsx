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
import { LinearGradient } from 'expo-linear-gradient';
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

function getBackgroundStyle(
  variant: BubbleButtonVariant,
  pressed: boolean,
  isDisabled: boolean,
): ViewStyle {
  if (variant === 'primary') {
    if (isDisabled) return { backgroundColor: B.primary.disabled };
    if (pressed) return { backgroundColor: B.primary.pressed };
    return {};
  }
  if (variant === 'outline') {
    const borderColor = isDisabled ? B.outline.disabledStroke : B.outline.stroke;
    if (pressed) return { borderWidth: 1, borderColor, backgroundColor: `${B.outline.stroke}1A` };
    return { borderWidth: 1, borderColor };
  }
  if (variant === 'destructive') {
    if (pressed) return { borderWidth: 1, borderColor: B.destructive.stroke, backgroundColor: `${B.destructive.stroke}1A` };
    return { borderWidth: 1, borderColor: B.destructive.stroke };
  }
  if (variant === 'ghost') {
    if (pressed) return { borderWidth: 1, borderColor: B.ghost.stroke, backgroundColor: `${B.ghost.pressedFillColor}1A` };
    return { borderWidth: 1, borderColor: B.outline.disabledStroke };
  }
  return {};
}

function getTextColor(variant: BubbleButtonVariant, isDisabled: boolean): string {
  if (variant === 'primary') return B.primary.text;
  if (variant === 'outline') return isDisabled ? B.outline.disabledText : B.outline.text;
  if (variant === 'destructive') return B.destructive.text;
  if (variant === 'ghost') return B.ghost.text;
  return B.primary.text;
}

function BubbleButton({
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
  const usesGradient = variant === 'primary' && !isDisabled;
  const textColor = getTextColor(variant, isDisabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={[styles.wrapper, style]}
    >
      {({ pressed }) => {
        const bgStyle = getBackgroundStyle(variant, pressed, isDisabled);
        const showGradient = usesGradient && !pressed;

        return (
          <View style={[styles.inner, bgStyle]}>
            {showGradient && (
              <LinearGradient
                colors={[B.primary.gradient.start, '#5CBBF9', '#8AD0FB']}
                locations={[0, 0.7, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {loading ? (
              <ActivityIndicator
                color={variant === 'primary' ? B.primary.text : B.outline.text}
                size="small"
              />
            ) : (
              <>
                {icon && <View style={styles.iconWrap}>{icon}</View>}
                <Text
                  style={[
                    styles.text,
                    { color: textColor },
                    textStyle,
                  ]}
                >
                  {title}
                </Text>
              </>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

export default React.memo(BubbleButton);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  inner: {
    height: B.height,
    borderRadius: B.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  iconWrap: {
    marginRight: 6,
  },
  text: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as TextStyle['fontWeight'],
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
