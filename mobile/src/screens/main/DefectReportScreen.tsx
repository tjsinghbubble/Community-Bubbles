import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

export default function DefectReportScreen() {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'defect_report', message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      Alert.alert(
        'Report Received',
        'Thanks for reporting this issue. We\'ll look into it and work to get it fixed.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [message, token, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Report a Bug" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Found a bug?</Text>
          <Text style={styles.body}>
            Describe what happened and how to reproduce it. Include any details that might help us track it down faster — what screen you were on, what you tapped, what you expected to see.
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textArea}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Describe the bug and steps to reproduce it..."
              placeholderTextColor={Colors.neutral.coolMist}
              textAlignVertical="top"
              maxLength={2000}
              testID="input-defect-message"
            />
            <Text style={styles.charCount}>{message.length}/2000</Text>
          </View>

          <BubbleButton
            title="Submit Report"
            onPress={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            loading={isSubmitting}
            testID="button-submit-defect"
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  heading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
  },
  body: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
  },
  inputWrapper: {
    gap: Spacing.xs,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    backgroundColor: '#FFFFFF',
    minHeight: 160,
    lineHeight: 22,
  },
  charCount: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },
});
