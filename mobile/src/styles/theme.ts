import { StyleSheet, Platform } from 'react-native';

export const Colors = {
  brand: {
    bubbleBlue: '#35A8F7',
    midnight: '#1E1F26',
    skyWhite: '#FFFFFF',
    background: '#FAFAFA',
  },

  neutral: {
    cloudGrey: '#F5F6F8',
    coolMist: '#969696',
    charcoal: '#4D4D4D',
  },

  state: {
    success: '#34C759',
    error: '#FF3B30',
    carrot: '#F9888C',
  },

  gradient: {
    gradient2Start: '#A8D8F7',
    gradient2End: '#35A8F7',
  },
};

export const Gradients = {
  button: {
    colors: [Colors.gradient.gradient2Start, Colors.gradient.gradient2End] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  alert: {
    colors: [Colors.gradient.gradient2Start, Colors.gradient.gradient2End] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
};

export const Typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    heading: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const IconColors = {
  default: Colors.neutral.charcoal,
  active: Colors.brand.bubbleBlue,
  inactive: Colors.neutral.coolMist,
  error: Colors.state.error,
};

export const LogoVariants = {
  dark: {
    background: Colors.brand.midnight,
    symbolColor: Colors.brand.skyWhite,
    textColor: Colors.brand.skyWhite,
  },
  blue: {
    background: Colors.brand.bubbleBlue,
    symbolColor: Colors.brand.skyWhite,
    textColor: Colors.brand.skyWhite,
  },
  light: {
    background: Colors.brand.skyWhite,
    symbolColor: Colors.brand.bubbleBlue,
    textColor: Colors.brand.bubbleBlue,
  },
};

export const LoadingState = {
  spinnerColor: Colors.brand.bubbleBlue,
  trackColor: '#E8E8E8',
  textColor: Colors.neutral.charcoal,
  backgroundColor: Colors.brand.background,
};

export const ButtonStyles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
  },

  primaryGradient: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden' as const,
  },

  secondary: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand.bubbleBlue,
  },

  disabled: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.neutral.coolMist,
  },

  outline: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand.skyWhite,
    borderWidth: 1.5,
    borderColor: Colors.brand.bubbleBlue,
  },

  light: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#D6EEFF',
  },

  ghost: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand.skyWhite,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },

  destructive: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand.skyWhite,
    borderWidth: 1.5,
    borderColor: Colors.state.error,
  },
});

export const ButtonTextStyles = StyleSheet.create({
  primaryGradient: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.skyWhite,
  },
  secondary: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.skyWhite,
  },
  disabled: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.skyWhite,
  },
  outline: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
  },
  light: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
  },
  ghost: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.coolMist,
  },
  destructive: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.state.error,
  },
});

export const InputStyles = StyleSheet.create({
  label: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.sm,
  },
  requiredAsterisk: {
    color: Colors.state.error,
  },
  field: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    backgroundColor: Colors.brand.skyWhite,
  },
  fieldError: {
    borderColor: Colors.state.error,
    borderWidth: 1.5,
  },
  fieldFocused: {
    borderColor: Colors.brand.bubbleBlue,
    borderWidth: 1.5,
  },
  placeholder: {
    color: Colors.neutral.coolMist,
  },
  errorMessage: {
    fontSize: Typography.sizes.sm,
    color: Colors.state.error,
    marginTop: Spacing.xs,
  },
  subtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    marginTop: Spacing.xs,
  },
  forgotLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.bubbleBlue,
    marginTop: Spacing.sm,
  },
  fieldWithIcon: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingRight: 48,
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    backgroundColor: Colors.brand.skyWhite,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  iconRight: {
    position: 'absolute' as const,
    right: Spacing.lg,
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
});

export const TextAreaStyles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    backgroundColor: Colors.brand.skyWhite,
    minHeight: 120,
    textAlignVertical: 'top' as const,
  },
  fieldError: {
    borderColor: Colors.state.error,
    borderWidth: 1.5,
  },
  charCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    textAlign: 'right' as const,
    marginTop: Spacing.xs,
  },
  charCountError: {
    color: Colors.state.error,
  },
});

export const SelectStyles = StyleSheet.create({
  field: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.brand.skyWhite,
  },
  fieldText: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
  },
  fieldPlaceholder: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
  },
});

export const SelectColors = {
  chevron: Colors.neutral.charcoal,
};

export const RadioStyles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: Spacing.md,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  circleSelected: {
    borderColor: Colors.brand.bubbleBlue,
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  label: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginLeft: Spacing.md,
  },
  description: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    marginLeft: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.brand.skyWhite,
  },
  cardSelected: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: Colors.neutral.cloudGrey,
  },
});

export const CheckboxStyles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: Spacing.md,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  boxChecked: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
  },
  label: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    marginLeft: Spacing.md,
  },
});

export const CheckboxColors = {
  checkmark: Colors.brand.skyWhite,
};

export const SwitchColors = {
  trackFalse: '#E0E0E0',
  trackTrue: '#A8D8F7',
  thumbFalse: '#F4F3F4',
  thumbTrue: Colors.brand.bubbleBlue,
};

const theme = {
  Colors,
  Gradients,
  Typography,
  Spacing,
  Radius,
  IconColors,
  LogoVariants,
  LoadingState,
  ButtonStyles,
  ButtonTextStyles,
  InputStyles,
  TextAreaStyles,
  SelectStyles,
  SelectColors,
  RadioStyles,
  CheckboxStyles,
  CheckboxColors,
  SwitchColors,
};

export default theme;
