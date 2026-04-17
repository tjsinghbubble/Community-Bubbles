import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NavHeader } from '../../components/ScreenHeader';


const OPEN_ISSUES = [
  { id: '6148', status: 'In progress', createdAgo: '59 minutes ago' },
  { id: '6088', status: 'In progress', createdAgo: '1 minutes ago' },
];

export default function HelpCenterScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Help Center" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subHeader}>Get help or support</Text>
        <Text style={styles.bodyText}>
          You can report a Bubble or Event concern here. For help with a Bubble, Event, or your account,{' '}
          <Text
            style={styles.link}
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
          >
            start here
          </Text>
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subHeaderRegular}>For emergencies</Text>
        <Text style={styles.emergencyHeading}>
          If you feel unsafe or are concerned about your or someone else's well-being, please contact local emergency services immediately.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subHeader}>Urgent Event situations</Text>
        <Text style={styles.bodyText}>
          Reach out to Event Admins if there's a issue or disturbance happening nearby.
        </Text>

        <View style={styles.divider} />

        <AnimatedPressable
          style={styles.openIssuesLink}
          scaleValue={0.98}
          onPress={() => {}}
          testID="link-open-issues"
        >
          <Text style={styles.openIssuesLinkText}>
            Need help with an issue we're already working on?
          </Text>
        </AnimatedPressable>
        <Text style={styles.bodyText}>
          Select an open issue to add more details or ask for an update.
        </Text>

        <View style={styles.issuesCard}>
          {OPEN_ISSUES.map((issue, index) => (
            <View key={issue.id}>
              {index > 0 && <View style={styles.separator} />}
              <AnimatedPressable
                style={styles.issueRow}
                scaleValue={0.97}
                onPress={() => Alert.alert('Issue Details', `Issue #${issue.id} details will be available in a future update.`)}
                testID={`button-issue-${issue.id}`}
              >
                <View style={styles.issueInfo}>
                  <Text style={styles.issueTitle}>Issue ending in #{issue.id}</Text>
                  <View style={styles.issueMetaRow}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{issue.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.issueCreated}>Created {issue.createdAgo}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            </View>
          ))}
        </View>

        <AnimatedPressable
          style={styles.reportButton}
          scaleValue={0.97}
          onPress={() => navigation.navigate('ReportConcern')}
          testID="button-report-new-issue"
        >
          <Text style={styles.reportButtonText}>Report a new issue</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  subHeader: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  subHeaderRegular: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.regular,
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    lineHeight: 22,
  },
  link: {
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  emergencyHeading: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#D9D9D9',
    marginVertical: Spacing.lg,
  },
  openIssuesLink: {
    marginBottom: 6,
  },
  openIssuesLinkText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  issuesCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    ...CardShadow,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  issueInfo: {
    flex: 1,
  },
  issueTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 6,
  },
  issueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: Colors.background.warningTint,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.status.warning,
  },
  issueCreated: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  reportButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
});
