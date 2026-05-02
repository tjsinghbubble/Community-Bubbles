import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon } from '../../components/icons';
import SuccessModal from '../../components/SuccessModal';
import { API_URL } from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isCodeComplete = code.every((d) => d !== '');
  const canSubmit = isCodeComplete && newPassword.length >= 8 && newPassword === confirmPassword;

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

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.emailFailed && data.fallbackCode) {
        Alert.alert(
          'Email Delivery Failed',
          `We couldn't send the email, but your reset code is:\n\n${data.fallbackCode}\n\nPlease copy it.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Code Sent', 'A new reset code has been sent to your email.');
      }
    } catch {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.join(''), newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to reset password. Please try again.');
        return;
      }
      setShowSuccessModal(true);
    } catch {
      Alert.alert('Error', 'Failed to reset password. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <Text style={styles.title}>Enter your reset code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to your email. Enter it below along with your new password.
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                testID={`input-reset-code-${index}`}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
          >
            {resending
              ? <ActivityIndicator color={Colors.brand.bubbleBlue} size="small" />
              : <Text style={styles.resendText}>Didn't get the code? Send again</Text>}
          </TouchableOpacity>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#969696"
                  testID="input-new-password"
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(v => !v)}>
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
                  secureTextEntry={!showConfirmPassword}
                  textContentType="newPassword"
                  placeholder=""
                  placeholderTextColor="#969696"
                  testID="input-confirm-password"
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(v => !v)}>
                  {showConfirmPassword ? <EyeIcon size={24} color="#969696" /> : <EyeOffIcon size={24} color="#969696" />}
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
            </View>

            <BubbleButton
              title="Reset Password"
              onPress={handleSubmit}
              disabled={!canSubmit || isLoading}
              loading={isLoading}
              testID="button-reset-password"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccessModal}
        title="Password Reset!"
        subtitle="Your password has been updated. You can now log in with your new password."
        buttonText="Back to Login"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.navigate('Login');
        }}
      />
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
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 33,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    lineHeight: 22,
    marginBottom: 28,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
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
  resendButton: {
    alignSelf: 'center',
    marginBottom: 28,
    padding: 4,
  },
  resendText: {
    fontSize: 14,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
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
  errorText: {
    fontSize: 12,
    color: Colors.status.error,
    marginTop: 2,
  },
});
