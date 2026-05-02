import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';

type FeedbackDetailRouteProp = RouteProp<ProfileStackParamList, 'FeedbackDetail'>;

const TYPE_LABELS: Record<string, string> = {
  feedback: 'Feedback',
  feature: 'Feature Request',
  defect: 'Defect Report',
  help: 'Help Request',
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  feedback: 'chatbubble-ellipses-outline',
  feature: 'bulb-outline',
  defect: 'bug-outline',
  help: 'help-circle-outline',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FeedbackDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<FeedbackDetailRouteProp>();
  const { item } = route.params;

  const label = TYPE_LABELS[item.type] ?? item.type;
  const icon = TYPE_ICONS[item.type] ?? 'document-text-outline';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title={label} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={22} color={Colors.brand.bubbleBlue} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.typeLabel}>{label}</Text>
              <Text style={styles.dateLabel}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.messageLabel}>Your message</Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Submitted — under review by our team</Text>
          </View>
        </View>

        <Text style={styles.note}>
          We review every submission. If you need a direct response, email us at{' '}
          <Text style={styles.emailLink}>support@trybubble.io</Text>
        </Text>
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
  card: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  typeLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: 2,
  },
  dateLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: Spacing.lg,
  },
  messageLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 24,
  },
  statusCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.status.warning,
  },
  statusText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    fontWeight: Typography.weights.medium,
  },
  note: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  emailLink: {
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
});
