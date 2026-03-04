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

  const getContainerStyle = (pressed: boolean): StyleProp<ViewStyle> => {
    const base: ViewStyle = {
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      flexDirection: 'row',
      overflow: 'hidden',
    };

    if (variant === 'primary') {
      if (isDisabled) return [base, { backgroundColor: '#969696' }, style].filter(Boolean) as ViewStyle[];
      if (pressed) return [base, { backgroundColor: '#37ADFF' }, style].filter(Boolean) as ViewStyle[];
      return [base, style].filter(Boolean) as ViewStyle[];
    }

    if (variant === 'outline') {
      if (isDisabled)
        return [base, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#98B4C8' }, style].filter(Boolean) as ViewStyle[];
      if (pressed)
        return [base, { backgroundColor: 'rgba(53, 168, 247, 0.15)', borderWidth: 1, borderColor: Colors.brand.primary }, style].filter(Boolean) as ViewStyle[];
      return [base, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.brand.primary }, style].filter(Boolean) as ViewStyle[];
    }

    if (variant === 'destructive') {
      if (pressed)
        return [base, { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderWidth: 1, borderColor: '#FF3B30' }, style].filter(Boolean) as ViewStyle[];
      return [base, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF3B30' }, style].filter(Boolean) as ViewStyle[];
    }

    if (variant === 'ghost') {
      if (pressed)
        return [base, { backgroundColor: 'rgba(53, 168, 247, 0.08)', borderWidth: 1, borderColor: '#98B4C8' }, style].filter(Boolean) as ViewStyle[];
      return [base, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#98B4C8' }, style].filter(Boolean) as ViewStyle[];
    }

    return [base, style].filter(Boolean) as ViewStyle[];
  };

  const getTextColor = (): string => {
    if (variant === 'primary') return '#FFFFFF';
    if (variant === 'outline') return isDisabled ? '#98B4C8' : Colors.brand.primary;
    if (variant === 'destructive') return '#FF3B30';
    if (variant === 'ghost') return '#98B4C8';
    return '#FFFFFF';
  };

  const showGradient = variant === 'primary' && !isDisabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => getContainerStyle(pressed)}
    >
      {({ pressed }) => (
        <>
          {showGradient && !pressed && (
            <LinearGradient
              colors={['#35A8F7', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 2.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
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
