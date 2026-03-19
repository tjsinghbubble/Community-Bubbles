import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { API_URL } from '../../config/api';
import SuccessModal from '../../components/SuccessModal';


type DataConfirmAccountParams = {
  DataConfirmAccount: { flow: 'request' | 'delete'; reason: string };
};

export default function DataConfirmAccountScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DataConfirmAccountParams, 'DataConfirmAccount'>>();
  const { flow, reason } = route.params;
  const { user, token, logout } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isCodeComplete = code.every((digit) => digit !== '');

  const maskedEmail = user?.email
    ? (() => {
        const [local, domain] = (user.email as string).split('@');
        const [domainName, tld] = domain.split('.');
        const maskedLocal = local.substring(0, 2) + '****';
        const maskedDomain = domainName.substring(0, 2) + '***';
        return `${maskedLocal}@${maskedDomain}.${tld}`;
      })()
    : '';

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

  const VALID_CODE = '122333';

  const handleConfirm = async () => {
    if (!isCodeComplete) return;
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const enteredCode = code.join('');
      if (enteredCode !== VALID_CODE) {
        Alert.alert('Incorrect Code', 'The code you entered is incorrect. Please check your email and try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      if (flow === 'request') {
        const response = await fetch(`${API_URL}/api/users/me/export`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch your data.');
        const exportData = await response.json();
        const filename = `bubble-data-${new Date().toISOString().split('T')[0]}.json`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2), {
          encoding: 'utf8',
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save your Bubble data',
            UTI: 'public.json',
          });
        }
        setShowSuccessModal(true);
      } else {
        const response = await fetch(`${API_URL}/api/auth/delete-account`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to delete your account. Please try again.');
        await logout();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const successTitle = 'Data Ready';
  const successSubtitle =
    'Your data file is ready. Use the share sheet to save it to your Files app or send it to yourself.';

  return (
    <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={styles.headerTitle}>Confirm Account</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => navigation.goBack()}
                  testID="button-close"
                >
                  <Ionicons name="close" size={24} color={Colors.brand.midnight} />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <Text style={styles.description}>
                  To continue, you'll need to confirm your account through one of the following option
                </Text>

                <TouchableOpacity
                  style={styles.methodDropdown}
                  onPress={() => setShowMethodDropdown(!showMethodDropdown)}
                  testID="button-method-dropdown"
                >
                  <View style={styles.methodLeft}>
                    <Ionicons name="mail-outline" size={20} color={Colors.neutral.charcoal} />
                    <Text style={styles.methodText}>Email</Text>
                  </View>
                  <Ionicons
                    name={showMethodDropdown ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.neutral.coolMist}
                  />
                </TouchableOpacity>

                <Text style={styles.maskedEmail}>{maskedEmail}</Text>

                <View style={styles.codeContainer}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        inputRefs.current[index] = ref;
                      }}
                      style={[styles.codeInput, digit && styles.codeInputFilled]}
                      value={digit}
                      onChangeText={(value) => handleCodeChange(value, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      testID={`input-code-${index}`}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.confirmButton, !isCodeComplete && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={!isCodeComplete || loading}
                  testID="button-confirm"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.linksContainer}>
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resending}
                    testID="button-resend"
                  >
                    {resending ? (
                      <ActivityIndicator color={Colors.brand.bubbleBlue} size="small" />
                    ) : (
                      <Text style={styles.linkText}>Didn't get an email? Send again</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => Alert.alert('Coming Soon', 'Additional verification methods will be available in a future update.')}
                    testID="button-try-another"
                  >
                    <Text style={styles.linkText}>Try another option</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <SuccessModal
          visible={showSuccessModal}
          title={successTitle}
          subtitle={successSubtitle}
          onClose={() => {
            setShowSuccessModal(false);
            navigation.navigate('PrivacySettings');
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    marginHorizontal: 20,
    alignSelf: 'stretch',
    overflow: 'hidden',
    ...CardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  description: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  methodDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  methodText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
  },
  maskedEmail: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: 42,
    height: 52,
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
  confirmButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  confirmButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  linksContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  linkText: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
});
