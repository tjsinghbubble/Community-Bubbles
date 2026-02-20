import { StyleSheet, Platform } from 'react-native';

export const Colors = {
  text: {
    primary: '#1E1F26',
    secondary: '#4D4D4D',
    tertiary: '#969696',
    disabled: '#C7C7CC',
  },

  background: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    surface: '#F5F6F8',
    card: '#FFFFFF',
  },

  border: {
    default: '#E2E2E2',
    light: '#F0F0F0',
    focus: '#35A8F7',
    disabled: '#98B4C8',
  },

  status: {
    success: '#34C759',
    warning: '#F59E0B',
    error: '#FF3B30',
    info: '#35A8F7',
  },

  brand: {
    primary: '#35A8F7',
    primaryLight: '#5AB9EA',
    primaryDark: '#2A8AD4',
    accent: '#0EADFF',
    bubbleBlue: '#35A8F7',
    midnight: '#1E1F26',
    skyWhite: '#FFFFFF',
    background: '#FAFAFA',
  },

  neutral: {
    black: '#000000',
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
    gradient2Start: '#35A8F7',
    gradient2End: '#FFFFFF',
  },
};

export const Gradients = {
  button: {
    colors: [Colors.gradient.gradient2Start, Colors.gradient.gradient2End] as const,
    start: { x: 0, y: 0 },
    end: { x: 0.65, y: 1.65 },
  },
  alert: {
    colors: [Colors.gradient.gradient2Start, Colors.gradient.gradient2End] as const,
    start: { x: 0, y: 0 },
    end: { x: 0.65, y: 1.65 },
  },
};

export const Typography = {
  fontFamily: {
    regular: Platform.select({ ios: 'System', android: 'Roboto' }),
    medium: Platform.select({ ios: 'System', android: 'Roboto' }),
    demiBold: Platform.select({ ios: 'System', android: 'Roboto' }),
    bold: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  sizes: {
    xxs: 9,
    xs: 10,
    sm: 11,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    hero: 34,
    heading: 28,
  },
  lineHeight: {
    sm: 15.03,
    base: 19.12,
    md: 21.86,
    lg: 24.59,
    xl: 27.32,
  },
  letterSpacing: {
    tight: -0.5,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  huge: 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 100,
  round: 9999,
};

export const IconColors = {
  default: Colors.text.secondary,
  active: Colors.brand.primary,
  inactive: Colors.text.tertiary,
  error: Colors.status.error,
};

export const LogoVariants = {
  dark: {
    background: Colors.brand.midnight,
    symbolColor: Colors.brand.skyWhite,
    textColor: Colors.brand.skyWhite,
  },
  blue: {
    background: Colors.brand.primary,
    symbolColor: Colors.brand.skyWhite,
    textColor: Colors.brand.skyWhite,
  },
  light: {
    background: Colors.brand.skyWhite,
    symbolColor: Colors.brand.primary,
    textColor: Colors.brand.primary,
  },
};

export const LoadingState = {
  spinnerColor: Colors.brand.primary,
  trackColor: '#E8E8E8',
  textColor: Colors.text.primary,
  backgroundColor: Colors.background.secondary,
};

export const ButtonStyles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
  },

  primaryGradient: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden' as const,
  },

  secondary: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#37ADFF',
  },

  disabled: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#969696',
  },

  outline: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
  },

  pressed: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(53, 168, 247, 0.15)',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
  },

  light: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#D6EEFF',
  },

  ghost: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#98B4C8',
  },

  destructive: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.status.error,
  },
});

export const ButtonTextStyles = StyleSheet.create({
  primaryGradient: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: Typography.letterSpacing.tight,
  },
  secondary: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: Typography.letterSpacing.tight,
  },
  disabled: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: Typography.letterSpacing.tight,
  },
  outline: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.brand.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  pressed: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.brand.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  light: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.brand.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  ghost: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: '#98B4C8',
    letterSpacing: Typography.letterSpacing.tight,
  },
  destructive: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.status.error,
    letterSpacing: Typography.letterSpacing.tight,
  },
});

export const InputStyles = StyleSheet.create({
  label: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: '#4D4D4D',
    marginBottom: Spacing.sm,
  },
  requiredAsterisk: {
    color: Colors.status.error,
  },
  field: {
    height: 56,
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.primary,
  },
  fieldError: {
    borderColor: Colors.status.error,
    borderWidth: 1,
  },
  fieldFocused: {
    borderColor: Colors.border.focus,
    borderWidth: 1,
  },
  placeholder: {
    color: '#969696',
  },
  errorMessage: {
    fontSize: Typography.sizes.sm,
    color: Colors.status.error,
    marginTop: Spacing.xs,
  },
  subtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  forgotLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    marginTop: Spacing.sm,
  },
  fieldWithIcon: {
    height: 56,
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingRight: 48,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.primary,
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
    borderColor: '#969696',
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.primary,
    minHeight: 120,
    textAlignVertical: 'top' as const,
  },
  fieldError: {
    borderColor: Colors.status.error,
    borderWidth: 1,
  },
  charCount: {
    fontSize: Typography.sizes.sm,
    color: '#969696',
    textAlign: 'right' as const,
    marginTop: Spacing.xs,
  },
  charCountError: {
    color: Colors.status.error,
  },
});

export const SelectStyles = StyleSheet.create({
  field: {
    height: 56,
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.background.primary,
  },
  fieldText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  fieldPlaceholder: {
    fontSize: Typography.sizes.base,
    color: '#969696',
  },
});

export const SelectColors = {
  chevron: Colors.text.secondary,
};

export const SliderStyles = {
  track: {
    height: Spacing.xs,
    background: Colors.border.light,
    radius: Radius.full,
  },
  fill: {
    background: Colors.brand.primary,
  },
  thumb: {
    size: Spacing.lg,
    background: Colors.background.primary,
    border: Colors.border.focus,
    radius: Radius.full,
  },
};

export const ModalStyles = {
  overlay: {
    background: Colors.neutral.black,
    opacity: 0.4,
  },
  container: {
    background: Colors.background.card,
    radius: Radius.xl,
    padding: Spacing.lg,
  },
  header: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.lineHeight.md,
  },
  footer: {
    gap: Spacing.md,
  },
};

export const RadioStyles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: Spacing.md,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#969696',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  circleSelected: {
    borderColor: '#35A8F7',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#35A8F7',
  },
  label: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  description: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginLeft: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background.card,
  },
  cardSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: Colors.background.surface,
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
    borderRadius: Radius.xs,
    borderWidth: 2,
    borderColor: Colors.border.default,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  boxChecked: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  label: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
});

export const CheckboxColors = {
  checkmark: Colors.background.primary,
};

export const SwitchColors = {
  trackFalse: '#E0E0E0',
  trackTrue: '#A8D8F7',
  thumbFalse: '#F4F3F4',
  thumbTrue: Colors.brand.primary,
};

export const CardStyles = {
  default: {
    background: Colors.background.card,
    radius: Radius.lg,
    border: Colors.border.default,
  },
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
  SliderStyles,
  ModalStyles,
  RadioStyles,
  CheckboxStyles,
  CheckboxColors,
  SwitchColors,
  CardStyles,
};

export default theme;
