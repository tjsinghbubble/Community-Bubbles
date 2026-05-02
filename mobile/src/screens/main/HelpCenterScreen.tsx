import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NavHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

type FeedbackType = 'feedback' | 'feature' | 'defect' | 'help';

export type FeedbackItem = {
  id: number;
  type: FeedbackType;
  message: string;
  createdAt: string;
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  feedback: 'Feedback',
  feature: 'Feature Request',
  defect: 'Defect Report',
  help: 'Help Request',
};

const TYPE_ICONS: Record<FeedbackType, keyof typeof Ionicons.glyphMap> = {
  feedback: 'chatbubble-ellipses-outline',
  feature: 'bulb-outline',
  defect: 'bug-outline',
  help: 'help-circle-outline',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function HelpCenterScreen() {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [issues, setIssues] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/feedback/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Help Center" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.subHeader}>Get help or support</Text>
        <Text style={styles.bodyText}>
          You can report a Bubble or Event concern here. For help with a Bubble, Event, or your account,{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('ReportConcern')}
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

        <Text style={styles.sectionHeading}>
          Need help with an issue we're already working on?
        </Text>
        <Text style={styles.bodyText}>
          Select a submitted issue to view details or check its status.
        </Text>

        {loading ? (
          <ActivityIndicator
            style={styles.loader}
            color={Colors.brand.bubbleBlue}
          />
        ) : issues.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={Colors.text.tertiary} />
            <Text style={styles.emptyText}>No issues submitted yet</Text>
          </View>
        ) : (
          <View style={styles.issuesCard}>
            {issues.map((issue, index) => (
              <View key={issue.id}>
                {index > 0 && <View style={styles.separator} />}
                <AnimatedPressable
                  style={styles.issueRow}
                  scaleValue={0.97}
                  onPress={() => navigation.navigate('FeedbackDetail', { item: issue })}
                  testID={`button-issue-${issue.id}`}
                >
                  <View style={styles.issueIconWrap}>
                    <Ionicons
                      name={TYPE_ICONS[issue.type]}
                      size={20}
                      color={Colors.brand.bubbleBlue}
                    />
                  </View>
                  <View style={styles.issueInfo}>
                    <Text style={styles.issueTitle}>{TYPE_LABELS[issue.type]}</Text>
                    <Text style={styles.issuePreview} numberOfLines={1}>
                      {issue.message}
                    </Text>
                    <Text style={styles.issueCreated}>
                      Submitted {timeAgo(issue.createdAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
                </AnimatedPressable>
              </View>
            ))}
          </View>
        )}

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
  sectionHeading: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: 6,
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
  loader: {
    marginTop: Spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
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
    backgroundColor: '#F0F0F0',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  issueIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueInfo: {
    flex: 1,
  },
  issueTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 2,
  },
  issuePreview: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: 2,
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
    marginTop: Spacing.sm,
  },
  reportButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
});
