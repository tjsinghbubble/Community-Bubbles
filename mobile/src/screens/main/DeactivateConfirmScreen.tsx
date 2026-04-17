import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import SuccessModal from '../../components/SuccessModal';
import ScreenHeader from '../../components/ScreenHeader';


type DeactivateConfirmParams = {
  DeactivateConfirm: { reason: string };
};

export default function DeactivateConfirmScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DeactivateConfirmParams, 'DeactivateConfirm'>>();
  const { user, token, logout } = useAuth();
  const [deactivating, setDeactivating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to deactivate account');
        return;
      }
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to deactivate account. Please try again.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Deactivate Account" onBack={() => navigation.goBack()} />

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
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <Text style={styles.confirmText}>
          Are you sure you want to deactivate your account? You will lose access to all your Bubbles, events, and messages.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.deactivateButton}
            onPress={handleDeactivate}
            disabled={deactivating}
            testID="button-yes-deactivate"
          >
            {deactivating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.deactivateButtonText}>Yes, Deactivate</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
            testID="button-no-go-back"
          >
            <Text style={styles.goBackButtonText}>No, go back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SuccessModal
        visible={showSuccessModal}
        title="Account Deactivated"
        subtitle="Your account has been successfully deactivated"
        onClose={async () => {
          setShowSuccessModal(false);
          await logout();
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
    ...CardShadow,
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
  confirmText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    gap: Spacing.md,
  },
  deactivateButton: {
    backgroundColor: Colors.status.error,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deactivateButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  goBackButton: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goBackButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
});
