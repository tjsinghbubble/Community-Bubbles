import React, { useState, useCallback } from 'react';
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
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing, Typography, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { API_URL } from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      navigation.navigate('ResetPassword', { email: trimmed });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, navigation]);

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
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>
            Enter the email address linked to your account and we'll send you a code to reset your password.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              placeholder="you@example.com"
              placeholderTextColor="#969696"
              testID="input-email"
            />
          </View>

          <BubbleButton
            title="Send Reset Code"
            onPress={handleSubmit}
            disabled={!email.trim() || isLoading}
            loading={isLoading}
            testID="button-send-reset-code"
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
    gap: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.brand.midnight,
    marginTop: Spacing.lg,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
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
});
