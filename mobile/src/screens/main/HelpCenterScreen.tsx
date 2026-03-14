import React from 'react';
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
import { Colors, Spacing, Typography } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const OPEN_ISSUES = [
  { id: '6148', status: 'In progress', createdAgo: '59 minutes ago' },
  { id: '6088', status: 'In progress', createdAgo: '1 minutes ago' },
];

export default function HelpCenterScreen() {
  const navigation = useNavigation<any>();

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
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable
          style={styles.contactCard}
          scaleValue={0.97}
          onPress={() => Alert.alert('Coming Soon', 'Contact support will be available in a future update.')}
          testID="button-contact-us"
        >
          <View style={styles.contactLeft}>
            <Ionicons name="mail-outline" size={24} color={Colors.text.secondary} />
            <Text style={styles.contactText}>Contact us</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
        </AnimatedPressable>

        <Text style={styles.sectionHeader}>Need help with an issue we're already working on?</Text>
        <Text style={styles.sectionSub}>Select an open issue to add more details or ask for an update.</Text>

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
          onPress={() => Alert.alert('Coming Soon', 'Report a new issue will be available in a future update.')}
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
  contactCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  contactText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  sectionHeader: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  sectionSub: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  issuesCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
    ...CARD_SHADOW,
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
