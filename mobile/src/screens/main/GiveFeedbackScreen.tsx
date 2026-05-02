import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import SuccessModal from '../../components/SuccessModal';

export default function GiveFeedbackScreen() {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'feedback', message: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to submit feedback. Please try again.');
        return;
      }
      setShowSuccessModal(true);
    } catch {
      Alert.alert('Error', 'Failed to submit feedback. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Give us Feedback" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Share your feedback</Text>
          <Text style={styles.body}>
            Thanks for sharing your ideas, issues, or appreciation. We can't respond individually, but we read everything and pass it to the teams making Bubble better.
          </Text>

          <TextInput
            style={styles.textArea}
            placeholder="What's on your mind?"
            placeholderTextColor={Colors.neutral.coolMist}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
            testID="input-feedback-message"
          />
          <Text style={styles.charCount}>{message.length}/2000</Text>

          <TouchableOpacity
            style={[styles.submitButton, (!message.trim() || isLoading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!message.trim() || isLoading}
            testID="button-submit-feedback"
          >
            {isLoading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitButtonText}>Submit Feedback</Text>}
          </TouchableOpacity>

          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Need a direct response? </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('mailto:support@trybubble.io')}
              testID="link-contact-us"
            >
              <Text style={styles.contactLink}>Contact us</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccessModal}
        title="Feedback Received!"
        subtitle="Thank you for sharing your thoughts. We really appreciate it."
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
  },
  heading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 16,
    padding: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    backgroundColor: Colors.background.primary,
    minHeight: 160,
    lineHeight: 22,
  },
  charCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  submitButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  contactLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  contactLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
});
