import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import SuccessModal from '../../components/SuccessModal';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailVerification'>;
  route: RouteProp<AuthStackParamList, 'EmailVerification'>;
};

export default function EmailVerificationScreen({ navigation, route }: Props) {
  const { email, name, password, gender, dateOfBirth } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isCodeComplete = code.every(digit => digit !== '');

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value.charAt(value.length - 1);
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

    setLoading(true);
    try {
      const verifyResponse = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.join('') }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        Alert.alert('Error', verifyData.error || 'Invalid verification code');
        return;
      }

      navigation.navigate('Interests', {
        name,
        email,
        password,
        gender,
        dateOfBirth,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', data.error || 'Failed to send new code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Please enter the 6-digit verification code that was sent to your email. The code is valid for 30 minutes.
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.verifyButton,
            !isCodeComplete && styles.buttonDisabled,
          ]}
          onPress={handleVerify}
          disabled={!isCodeComplete || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.brand.skyWhite} />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

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
      </View>

      <SuccessModal
        visible={showSuccessModal}
        title="Code Sent!"
        subtitle="A new verification code has been sent to your email"
        onClose={() => setShowSuccessModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    color: Colors.neutral.charcoal,
  },
  codeInputFilled: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: Colors.brand.skyWhite,
  },
  verifyButton: {
    backgroundColor: Colors.neutral.coolMist,
    borderRadius: Radius.full,
    paddingVertical: 16,
    paddingHorizontal: 80,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  verifyButtonText: {
    color: Colors.brand.skyWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    borderWidth: 1,
    borderColor: Colors.brand.bubbleBlue,
    borderRadius: Radius.full,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  resendButtonText: {
    color: Colors.brand.bubbleBlue,
    fontSize: 16,
    fontWeight: '600',
  },
});
