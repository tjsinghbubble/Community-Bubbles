import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon } from '../../components/icons';
import { API_URL } from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isCodeComplete = code.every(d => d !== '');

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) value = value.charAt(value.length - 1);
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      Alert.alert('Code Sent', 'A new code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  }, [email]);

  const handleReset = useCallback(async () => {
    if (!isCodeComplete || !password) return;
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.join(''), newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      Alert.alert(
        'Password Reset',
        'Your password has been updated. Please log in with your new password.',
        [{ text: 'Log In', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [code, email, password, confirmPassword, isCodeComplete, navigation]);

  const isFormValid = isCodeComplete && password.length >= 8 && password === confirmPassword;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Reset Password" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to <Text style={styles.emailText}>{email}</Text>. Enter it below along with your new password.
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                value={digit}
                onChangeText={value => handleCodeChange(value, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                testID={`input-code-${index}`}
              />
            ))}
          </View>

          <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendRow}>
            <Text style={styles.resendText}>
              {resending ? 'Sending…' : 'Didn\'t get a code? Send again'}
            </Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                placeholder="At least 8 characters"
                placeholderTextColor="#969696"
                testID="input-new-password"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? <EyeIcon size={24} color="#969696" /> : <EyeOffIcon size={24} color="#969696" />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                placeholder="Repeat your new password"
                placeholderTextColor="#969696"
                testID="input-confirm-password"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirm(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showConfirm ? <EyeIcon size={24} color="#969696" /> : <EyeOffIcon size={24} color="#969696" />}
              </TouchableOpacity>
            </View>
          </View>

          <BubbleButton
            title="Reset Password"
            onPress={handleReset}
            disabled={!isFormValid || isLoading}
            loading={isLoading}
            testID="button-reset-password"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.brand.midnight,
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
  },
  emailText: {
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: Spacing.sm,
  },
  codeInput: {
    width: 44,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    color: Colors.neutral.charcoal,
  },
  codeInputFilled: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: '#FFFFFF',
  },
  resendRow: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: '#4D4D4D',
  },
  input: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
    fontSize: 16,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
