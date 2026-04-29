import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSpanExpiryEvents,
  clearSpanExpiryEvents,
  SpanExpiryEvent,
} from '../../utils/crashReporter';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';
import { FlowHeader } from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'SpanHealth'>;
};

const PHASE_LABEL: Record<SpanExpiryEvent['phase'], string> = {
  'pre-work': 'Pre-work',
  'post-work': 'Post-work',
};

const PHASE_COLOR: Record<SpanExpiryEvent['phase'], string> = {
  'pre-work': '#F59E0B',
  'post-work': '#FF6B6B',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function SpanHealthScreen({ navigation }: Props) {
  const [events, setEvents] = useState<SpanExpiryEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(() => {
    setEvents(getSpanExpiryEvents());
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleClear = () => {
    clearSpanExpiryEvents();
    setEvents([]);
  };

  const preWorkCount = events.filter((e) => e.phase === 'pre-work').length;
  const postWorkCount = events.filter((e) => e.phase === 'post-work').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlowHeader
        title="Span Health"
        onBack={() => navigation.goBack()}
        rightElement={
          events.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              testID="button-clear-span-events"
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.summaryBar} testID="span-health-summary-bar">
        <Ionicons
          name={events.length === 0 ? 'checkmark-circle-outline' : 'warning-outline'}
          size={16}
          color={events.length === 0 ? Colors.status.success : Colors.status.warning}
        />
        <Text style={styles.summaryText} testID="text-span-health-summary">
          {events.length === 0
            ? 'No span expiry events recorded'
            : `${events.length} event${events.length !== 1 ? 's' : ''}  ·  ${preWorkCount} pre-work  ·  ${postWorkCount} post-work`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
          />
        }
        testID="scroll-span-events"
      >
        {events.length === 0 ? (
          <View style={styles.emptyContainer} testID="container-empty">
            <Ionicons name="pulse-outline" size={48} color={Colors.text.tertiary} />
            <Text style={styles.emptyText} testID="text-no-events">
              No span expiry events
            </Text>
            <Text style={styles.emptySubtext}>
              Span timeouts detected by measureScreenLoad will appear here.
              Pull down to refresh after navigating through screens.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.legendRow} testID="legend-phases">
              <View style={styles.legendItem}>
                <View style={[styles.phaseDot, { backgroundColor: PHASE_COLOR['pre-work'] }]} />
                <Text style={styles.legendLabel}>Pre-work — span timed out before data load began</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.phaseDot, { backgroundColor: PHASE_COLOR['post-work'] }]} />
                <Text style={styles.legendLabel}>Post-work — span timed out during data load</Text>
              </View>
            </View>

            {events.map((event, index) => (
              <View
                key={`${event.screenName}-${event.phase}-${event.timestamp}-${index}`}
                style={styles.eventCard}
                testID={`card-span-event-${index}`}
              >
                <View style={styles.eventHeader}>
                  <View
                    style={[
                      styles.phaseTag,
                      { backgroundColor: PHASE_COLOR[event.phase] + '22' },
                    ]}
                  >
                    <View
                      style={[styles.phaseDot, { backgroundColor: PHASE_COLOR[event.phase] }]}
                    />
                    <Text
                      style={[styles.phaseLabel, { color: PHASE_COLOR[event.phase] }]}
                      testID={`text-phase-${index}`}
                    >
                      {PHASE_LABEL[event.phase]}
                    </Text>
                  </View>
                  <View style={styles.timestampCol}>
                    <Text style={styles.timeText} testID={`text-time-${index}`}>
                      {formatTimestamp(event.timestamp)}
                    </Text>
                    <Text style={styles.dateText}>
                      {formatDate(event.timestamp)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.screenName} testID={`text-screen-${index}`}>
                  {event.screenName}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  clearButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    fontWeight: '600',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  summaryText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  legendRow: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    flex: 1,
  },
  eventCard: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...CardShadow,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  phaseLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  timestampCol: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  dateText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  screenName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    fontFamily: 'monospace',
  },
});
