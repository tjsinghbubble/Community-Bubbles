import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import BubbleButton from '../../components/BubbleButton';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ CampusVerify: { email: string; campusName: string } }, 'CampusVerify'>;
};

export default function CampusVerifyScreen({ navigation, route }: Props) {
  const { email, campusName } = route.params;
  const { token, refreshUser } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isCodeComplete = code.every((digit) => digit !== '');

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value[value.length - 1];
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isCodeComplete) return;

    setIsLoading(true);
    apiService.setToken(token);

    try {
      const fullCode = code.join('');
      await apiService.verifyCampusCode(email, fullCode);
      
      if (refreshUser) {
        await refreshUser();
      }
      
      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    apiService.setToken(token);

    try {
      const response = await apiService.sendCampusVerification(email);
      
      if (response.emailFailed && response.fallbackCode) {
        Alert.alert(
          'Email Delivery Failed',
          `We couldn't send the email, but your verification code is:\n\n${response.fallbackCode}\n\nPlease copy it before continuing.`,
          [{ text: 'OK' }]
        );
      } else if (response.devCode) {
        Alert.alert('New Code Sent', `Your new code is: ${response.devCode}`);
      } else {
        Alert.alert('Success', 'A new verification code has been sent to your email');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >

        <View style={styles.iconContainer}>
          <View style={styles.emailIcon}>
            <Ionicons name="mail" size={48} color={Colors.brand.bubbleBlue} />
          </View>
        </View>

        <Text style={styles.title}>We've sent you an email with a 6 digit code.</Text>
        <Text style={styles.subtitle}>Enter it below to continue</Text>

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
            />
          ))}
        </View>

        <BubbleButton
          title="Verify"
          onPress={handleVerify}
          disabled={!isCodeComplete}
          loading={isLoading}
          style={styles.verifyButton}
          testID="button-verify-campus-code"
        />

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color={Colors.brand.bubbleBlue} />
          ) : (
            <Text style={styles.resendButtonText}>Send new code</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccessModal}
        title="Campus Verified!"
        subtitle={`You're now part of ${campusName}! Explore your campus community.`}
        buttonText="Let's Go!"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.popToTop();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  emailIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    marginBottom: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: Colors.background.primary,
  },
  codeInputFilled: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: Colors.background.primary,
  },
  verifyButton: {
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendButton: {
    padding: 12,
    alignItems: 'center',
  },
  resendButtonText: {
    color: Colors.brand.bubbleBlue,
    fontSize: 14,
    fontWeight: '500',
  },
});
