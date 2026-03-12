import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../../styles/theme';

const DEACTIVATE_REASONS = [
  'I no longer use Bubble.',
  "I can't join Bubbles and Events anymore.",
  'Other',
];

export default function DeactivateReasonScreen() {
  const navigation = useNavigation<any>();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const handleDeactivate = () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select why you want to deactivate your account.');
      return;
    }
    navigation.navigate('DeactivateConfirm', { reason: selectedReason });
  };

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
        <Text style={styles.headerTitle}>Why are you choosing to deactivate?</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
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
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.midnight,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
