import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Typography } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const DEACTIVATE_REASONS = [
  'I no longer use Bubble.',
  "I can't join Bubbles and Events anymore.",
  'Other',
];

export default function LoginSecurityScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const handleEditPassword = () => {
    Alert.alert('Coming Soon', 'Password change will be available in a future update.');
  };

  const handleDownloadData = () => {
    Alert.alert('Coming Soon', 'Download my data will be available in a future update.');
  };

  const handleDeleteData = () => {
    Alert.alert('Coming Soon', 'Delete my data will be available in a future update.');
  };

  const handleDeactivate = () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select why you want to deactivate your account.');
      return;
    }
    navigation.navigate('DeactivateConfirm', { reason: selectedReason });
  };

  const passwordLastUpdated = user?.updatedAt
    ? new Date(user.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Unknown';

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
        <Text style={styles.headerTitle}>Login & Security</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Login</Text>
        <View style={styles.section}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldInfo}>
              <Text style={styles.fieldLabel}>Password</Text>
              <Text style={styles.fieldSub}>Last updated on {passwordLastUpdated}</Text>
            </View>
            <TouchableOpacity onPress={handleEditPassword} testID="button-edit-password">
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={handleDownloadData}
            testID="button-download-data"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="download-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Download my data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={handleDeleteData}
            testID="button-delete-data"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="trash-bin-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Delete my data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.deactivateSection}>
          <Text style={styles.deactivateTitle}>Deactivate your account</Text>

          <Text style={styles.reasonLabel}>Why are you choosing this action?</Text>
          {DEACTIVATE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={styles.radioRow}
              onPress={() => setSelectedReason(reason)}
              testID={`radio-${reason.toLowerCase().replace(/[^a-z]/g, '-')}`}
            >
              <View style={[styles.radioOuter, selectedReason === reason && styles.radioOuterSelected]}>
                {selectedReason === reason && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioText}>{reason}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.deactivateButton, !selectedReason && styles.deactivateButtonDisabled]}
            onPress={handleDeactivate}
            disabled={!selectedReason}
            testID="button-deactivate"
          >
            <Text style={styles.deactivateButtonText}>Deactivate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    ...CARD_SHADOW,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 4,
  },
  fieldSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  editText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  deactivateSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#D9D9D9',
  },
  deactivateTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.lg,
  },
  reasonLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.md,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.brand.bubbleBlue,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  radioText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    flex: 1,
  },
  deactivateButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.status.error,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deactivateButtonDisabled: {
    opacity: 0.5,
  },
  deactivateButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
});
