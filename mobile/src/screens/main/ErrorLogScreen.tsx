import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'ErrorLog'>;
};

type ErrorEntry = {
  message: string;
  timestamp: string;
  platform: string;
  level: string;
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

type TimeFilter = 'all' | '24h' | '7d';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '24h', label: 'Last 24 h' },
  { key: '7d', label: 'Last 7 days' },
];

function sinceFromFilter(filter: TimeFilter): Date | undefined {
  if (filter === '24h') {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
  if (filter === '7d') {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

function levelColor(_level: string): string {
  return Colors.status.error;
}

export default function ErrorLogScreen({ navigation }: Props) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const timeFilterRef = useRef<TimeFilter>('all');
  timeFilterRef.current = timeFilter;

  const fetchErrors = useCallback(async (filter: TimeFilter = 'all') => {
    try {
      setFetchError(false);
      const since = sinceFromFilter(filter);
      const res = await apiService.getErrorLogs(since);
      setErrors(res?.errors ?? []);
    } catch (e) {
      console.warn('[ErrorLogScreen] Failed to fetch error logs:', e);
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      AsyncStorage.setItem('errorLogLastSeenAt', new Date().toISOString()).catch(() => {});
      fetchErrors(timeFilterRef.current);
    }, [fetchErrors]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchErrors(timeFilter);
  };

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    setLoading(true);
    setExpanded(new Set());
    fetchErrors(filter);
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Error Log',
      'Remove all buffered error entries? This only clears the in-memory buffer — Sentry still holds full history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.clearErrorLogs();
              setErrors([]);
              setExpanded(new Set());
            } catch (e) {
              Alert.alert('Error', 'Failed to clear error log.');
            }
          },
        },
      ],
    );
  };

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const renderItem = ({ item, index }: { item: ErrorEntry; index: number }) => {
    const isExpanded = expanded.has(index);
    const firstLine = item.message.split('\n')[0] ?? item.message;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => toggleExpanded(index)}
        activeOpacity={0.8}
        testID={`error-log-item-${index}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.levelDot, { backgroundColor: levelColor(item.level) }]} />
          <View style={styles.cardMeta}>
            <Text style={styles.cardPlatform} testID={`error-platform-${index}`}>
              {item.platform}
            </Text>
            <Text style={styles.cardTime} testID={`error-timestamp-${index}`}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.text.tertiary}
          />
        </View>
        <Text
          style={styles.cardMessage}
          numberOfLines={isExpanded ? undefined : 2}
          testID={`error-message-${index}`}
        >
          {isExpanded ? item.message : firstLine}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color={Colors.text.tertiary} />
        <Text style={styles.emptyText} testID="text-no-errors">
          No errors in the buffer
        </Text>
        <Text style={styles.emptySubtext}>
          In-memory server errors (since last restart) will appear here.
          Full history is available in Sentry.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <NavHeader
        title="Error Log"
        onBack={() => navigation.goBack()}
        rightElement={
          errors.length > 0 ? (
            <TouchableOpacity onPress={handleClear} testID="button-clear-errors">
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View style={styles.summaryBar}>
        <Ionicons name="warning-outline" size={16} color={Colors.text.secondary} />
        <Text style={styles.summaryText} testID="text-error-count">
          {errors.length === 0
            ? 'No in-memory server errors'
            : `${errors.length} in-memory server error${errors.length !== 1 ? 's' : ''} · last 100 · newest first`}
        </Text>
      </View>

      <View style={styles.filterBar}>
        {TIME_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, timeFilter === f.key && styles.filterChipActive]}
            onPress={() => handleFilterChange(f.key)}
            testID={`filter-${f.key}`}
          >
            <Text style={[styles.filterChipText, timeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fetchError && !loading && (
        <View style={styles.fetchErrorBanner} testID="banner-fetch-error">
          <Ionicons name="alert-circle-outline" size={16} color={Colors.status.error} />
          <Text style={styles.fetchErrorText}>
            Could not load error log. Pull down to try again.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.brand.primary} />
      ) : (
        <FlatList
          data={errors}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={errors.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.brand.primary}
            />
          }
          testID="list-error-logs"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
  },
  loader: {
    marginTop: Spacing.xl,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...CardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMeta: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPlatform: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTime: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  cardMessage: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
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
  },
  clearButton: {
    fontSize: Typography.sizes.base,
    color: Colors.status.error,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  filterChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fetchErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.errorTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  fetchErrorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.status.error,
    flex: 1,
  },
});
