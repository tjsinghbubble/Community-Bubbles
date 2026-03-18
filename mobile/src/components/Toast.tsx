import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, CardShadow } from '../styles/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastConfig = {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
};

type ToastState = ToastConfig & { id: number };

let toastRef: ((config: ToastConfig) => void) | null = null;

export function showToast(config: ToastConfig) {
  if (toastRef) {
    toastRef(config);
  }
}

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  info: 'information-circle',
  warning: 'warning',
};

const BG_COLORS: Record<ToastType, string> = {
  success: '#E8F8EE',
  error: '#FDEEEE',
  info: '#EAF4FE',
  warning: '#FFF8E8',
};

const ICON_COLORS: Record<ToastType, string> = {
  success: Colors.status.success,
  error: Colors.status.error,
  info: Colors.brand.primary,
  warning: '#F59E0B',
};

const TEXT_COLORS: Record<ToastType, string> = {
  success: '#1B7A3D',
  error: '#C62828',
  info: Colors.text.primary,
  warning: '#92400E',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const show = useCallback((config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    idRef.current += 1;
    const newToast: ToastState = {
      ...config,
      type: config.type || 'info',
      duration: config.duration || 3000,
      id: idRef.current,
    };

    translateY.setValue(-120);
    opacity.setValue(0);
    setToast(newToast);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      dismiss();
      config.onDismiss?.();
    }, newToast.duration);
  }, [translateY, opacity, dismiss]);

  useEffect(() => {
    toastRef = show;
    return () => { toastRef = null; };
  }, [show]);

  if (!toast) return <>{children}</>;

  const type = toast.type || 'info';

  return (
    <>
      {children}
      <Animated.View
        style={[
          styles.container,
          {
            top: insets.top + (Platform.OS === 'ios' ? 4 : 12),
            transform: [{ translateY }],
            opacity,
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            dismiss();
            toast.onDismiss?.();
          }}
          style={[styles.toast, { backgroundColor: BG_COLORS[type] }]}
        >
          <Ionicons
            name={ICONS[type]}
            size={22}
            color={ICON_COLORS[type]}
          />
          <Text
            style={[styles.message, { color: TEXT_COLORS[type] }]}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
          <Ionicons name="close" size={18} color={TEXT_COLORS[type]} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    ...CardShadow,
  },
  message: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    lineHeight: Typography.lineHeight.base,
  },
});
