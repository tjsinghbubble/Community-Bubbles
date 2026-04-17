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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

type DataRequestReasonParams = {
  DataRequestReason: { flow: 'request' | 'delete' };
};

const REASONS = [
  'I want to know what Bubble knows about me',
  'I want to file a support ticket',
  'I want to move my data to another service',
  'I plan to delete or deactivate my account soon',
  'I need to access specific data for legal reasons',
  'Other',
];

export default function DataRequestReasonScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DataRequestReasonParams, 'DataRequestReason'>>();
  const { flow } = route.params;
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const title = flow === 'request' ? 'Download My Data' : 'Delete My Data';
  const question =
    flow === 'request'
      ? 'Why are you requesting a copy of your data?'
      : 'Why do you want to delete your data?';

  const handleContinue = () => {
    navigation.navigate('DataConfirmAccount', { flow, reason: selectedReason || '' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>
          Before we get you a copy of your data, we will just need you to answer a few questions
        </Text>

        <Text style={styles.question}>{question}</Text>

        {REASONS.map((reason) => (
          <TouchableOpacity
            key={reason}
            style={styles.radioRow}
            onPress={() => setSelectedReason(selectedReason === reason ? null : reason)}
            testID={`radio-${reason.toLowerCase().replace(/[^a-z]/g, '-')}`}
          >
            <View style={[styles.radioOuter, selectedReason === reason && styles.radioOuterSelected]}>
              {selectedReason === reason && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioText}>{reason}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          testID="button-continue"
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
  },
  heading: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  question: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.md,
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
  continueButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
});
