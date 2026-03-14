import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../../styles/theme';

type DataRequestReasonParams = {
  DataRequestReason: { flow: 'request' | 'delete' };
};

const REQUEST_REASONS = [
  'I want a copy of my personal data.',
  'I need it for another service.',
  'Other',
];

const DELETE_REASONS = [
  'I no longer want my data stored.',
  'Privacy concerns.',
  'Other',
];

export default function DataRequestReasonScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DataRequestReasonParams, 'DataRequestReason'>>();
  const { flow } = route.params;
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const reasons = flow === 'request' ? REQUEST_REASONS : DELETE_REASONS;
  const title = flow === 'request' ? 'Request My Data' : 'Delete My Data';

  const handleContinue = () => {
    if (!selectedReason) return;
    navigation.navigate('DataConfirmAccount', { flow, reason: selectedReason });
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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          {flow === 'request'
            ? 'Why do you want to request your data?'
            : 'Why do you want to delete your data?'}
        </Text>

        {reasons.map((reason) => (
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
          style={[
            styles.continueButton,
            !selectedReason && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedReason}
          testID="button-continue"
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
  },
  subtitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.lg,
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
  continueButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  continueButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
});
