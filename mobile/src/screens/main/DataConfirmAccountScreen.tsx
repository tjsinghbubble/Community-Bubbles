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
  Image,
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
  const { flow, reason } = route.params;
  const { user } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const isCodeComplete = code.every((digit) => digit !== '');
  const title = flow === 'request' ? 'Confirm Your Account' : 'Confirm Your Account';

  const maskedEmail = user?.email
    ? user.email.replace(/^(.{2})(.*)(@.*)$/, (_, start, middle, domain) => {
        return start + '*'.repeat(Math.min(middle.length, 6)) + domain;
      })
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="button-back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.brand.midnight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          {user?.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{maskedEmail}</Text>
        </View>

        <Text style={styles.description}>
          Enter the 6-digit verification code sent to {maskedEmail} to confirm.
        </Text>

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
            <Text style={styles.confirmButtonText}>Confirm</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending}
          testID="button-resend"
        >
          {resending ? (
            <ActivityIndicator color={Colors.brand.bubbleBlue} />
          ) : (
            <Text style={styles.resendText}>Resend Code</Text>
          )}
        </TouchableOpacity>
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
  backButton: {
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    ...CARD_SHADOW,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  description: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
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
  resendButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
  },
  resendText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
});
