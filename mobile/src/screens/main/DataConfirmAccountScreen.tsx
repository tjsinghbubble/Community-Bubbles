import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Typography } from '../../styles/theme';
import SuccessModal from '../../components/SuccessModal';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

type DataConfirmAccountParams = {
  DataConfirmAccount: { flow: 'request' | 'delete'; reason: string };
};

export default function DataConfirmAccountScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DataConfirmAccountParams, 'DataConfirmAccount'>>();
  const { flow } = route.params;
  const { user } = useAuth();
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

  const handleConfirm = async () => {
    if (!isCodeComplete) return;
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Error', 'Verification failed. Please try again.');
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

  const successTitle = flow === 'request' ? 'Request Submitted' : 'Data Deletion Requested';
  const successSubtitle =
    flow === 'request'
      ? 'Your data request has been submitted. You will receive an email with your data shortly.'
      : 'Your data deletion request has been submitted. This process may take up to 30 days.';

  return (
    <SafeAreaView style={styles.container}>
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

      <SuccessModal
        visible={showSuccessModal}
        title={successTitle}
        subtitle={successSubtitle}
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
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
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
    ...CARD_SHADOW,
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
    width: 46,
    height: 56,
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
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 16,
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
