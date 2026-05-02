import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NavHeader } from '../../components/ScreenHeader';


export default function GetHelpScreen() {
  const navigation = useNavigation<any>();

  const navigateToForm = (type: 'feature' | 'defect' | 'help') => {
    const configs = {
      help: {
        type: 'help' as const,
        title: 'Get Help',
        subtitle: "Describe what you need help with and we'll pass it to our support team.",
        placeholder: "What do you need help with?",
        successTitle: 'Request Received!',
        successSubtitle: "We've received your help request and will look into it.",
        buttonLabel: 'Submit Request',
      },
      feature: {
        type: 'feature' as const,
        title: 'Feature Request',
        subtitle: "Have an idea that would make Bubble better? We'd love to hear it.",
        placeholder: "Describe the feature you'd like to see...",
        successTitle: 'Feature Request Sent!',
        successSubtitle: "Thanks for sharing your idea. We review all feature requests.",
        buttonLabel: 'Submit Request',
      },
      defect: {
        type: 'defect' as const,
        title: 'Report a Defect',
        subtitle: "Found a bug or something not working right? Let us know so we can fix it.",
        placeholder: "Describe the defect — what happened, and what you expected to happen...",
        successTitle: 'Defect Reported!',
        successSubtitle: "Thanks for the report. We'll investigate and work on a fix.",
        buttonLabel: 'Submit Report',
      },
    };
    navigation.navigate('FeedbackForm', configs[type]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Get Help" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('HelpCenter')}
            testID="button-report-concern"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="flag-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Report a Bubble or Concern</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.separator} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('GiveFeedback')}
            testID="button-give-feedback"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Give us Feedback</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.separator} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigateToForm('help')}
            testID="button-get-help"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Get Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.separator} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigateToForm('feature')}
            testID="button-feature-request"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="bulb-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Feature Request</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.separator} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigateToForm('defect')}
            testID="button-defect-report"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="bug-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Defect Report</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>
      </View>
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
    paddingTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    ...CardShadow,
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
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
});
