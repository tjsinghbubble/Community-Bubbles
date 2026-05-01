import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import apiService from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';

type Prefs = {
  pushPaused: boolean;
  bubbleActivity: boolean;
  eventActivity: boolean;
  eventReminders: boolean;
  taskReminders: boolean;
  waitlistUpdates: boolean;
  announcements: boolean;
};

const DEFAULT_PREFS: Prefs = {
  pushPaused: false,
  bubbleActivity: true,
  eventActivity: true,
  eventReminders: true,
  taskReminders: true,
  waitlistUpdates: true,
  announcements: true,
};

function cacheKey(userId: string | number): string {
  return `@notif_prefs_cache_${userId}`;
}

const PREFERENCE_SECTIONS = [
  {
    title: 'Bubbles',
    items: [
      {
        key: 'bubbleActivity' as keyof Prefs,
        label: 'Bubble activity',
        description: 'Join requests, approvals, role changes, and edits',
      },
    ],
  },
  {
    title: 'Events',
    items: [
      {
        key: 'eventActivity' as keyof Prefs,
        label: 'Event activity',
        description: 'New events, RSVPs, cancellations, and updates',
      },
      {
        key: 'eventReminders' as keyof Prefs,
        label: 'Event reminders',
        description: "24-hour and 1-hour reminders for events you're attending",
      },
      {
        key: 'taskReminders' as keyof Prefs,
        label: 'Task reminders',
        description: "Reminders for volunteer tasks you've signed up for",
      },
    ],
  },
  {
    title: 'Other',
    items: [
      {
        key: 'waitlistUpdates' as keyof Prefs,
        label: 'Waitlist updates',
        description: "When your waitlist position changes or you're approved",
      },
      {
        key: 'announcements' as keyof Prefs,
        label: 'Announcements & messages',
        description: 'Admin announcements and direct messages',
      },
    ],
  },
];

const PREF_KEYS: Array<keyof Prefs> = [
  'pushPaused',
  'bubbleActivity',
  'eventActivity',
  'eventReminders',
  'taskReminders',
  'waitlistUpdates',
  'announcements',
];

function mergeWithDefaults(raw: unknown): Prefs {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_PREFS };
  for (const k of PREF_KEYS) {
    if (typeof obj[k] === 'boolean') {
      result[k] = obj[k] as boolean;
    }
  }
  return result;
}

async function readCache(key: string): Promise<Prefs | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeCache(key: string, prefs: Prefs): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(prefs));
  } catch {
  }
}

type LoadState = 'loading' | 'loaded' | 'cached' | 'error';

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <View style={[skeletonStyles.row, !last && skeletonStyles.border]}>
      <View style={skeletonStyles.textGroup}>
        <View style={skeletonStyles.labelBar} />
        <View style={skeletonStyles.descBar} />
      </View>
      <View style={skeletonStyles.toggle} />
    </View>
  );
}

function SkeletonSection({ title, count }: { title: string; count: number }) {
  return (
    <View>
      <View style={skeletonStyles.sectionHeader} />
      <View style={styles.section}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} last={i === count - 1} />
        ))}
      </View>
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const userCacheKey = user?.id ? cacheKey(user.id) : null;
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  const fetchPrefs = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await apiService.getNotificationPreferences();
      const loaded: Prefs = mergeWithDefaults(data);
      setPrefs(loaded);
      if (userCacheKey) writeCache(userCacheKey, loaded);
      setLoadState('loaded');
    } catch {
      const cached = userCacheKey ? await readCache(userCacheKey) : null;
      if (cached) {
        setPrefs(cached);
        setLoadState('cached');
      } else {
        setLoadState('error');
      }
    }
  }, [userCacheKey]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleToggle = useCallback(async (key: keyof Prefs, value: boolean) => {
    const previous = prefs[key];
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(key);
    try {
      await apiService.updateNotificationPreferences({ [key]: value });
      if (userCacheKey) writeCache(userCacheKey, updated);
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      Alert.alert('Could not save', 'Your preference could not be saved. Please check your connection and try again.');
    } finally {
      setSaving(null);
    }
  }, [prefs, userCacheKey]);

  const isPaused = prefs.pushPaused;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Notification Preferences" onBack={() => navigation.goBack()} />

      {loadState === 'loading' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          testID="notif-prefs-skeleton"
        >
          <View style={skeletonStyles.introBanner} />
          <SkeletonSection title="Bubbles" count={1} />
          <SkeletonSection title="Events" count={3} />
          <SkeletonSection title="Other" count={2} />
        </ScrollView>
      ) : loadState === 'error' ? (
        <View style={styles.errorContainer} testID="notif-prefs-error">
          <Text style={styles.errorTitle}>Could not load preferences</Text>
          <Text style={styles.errorBody}>
            Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchPrefs}
            testID="button-retry-notif-prefs"
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Choose which push notifications you receive. In-app notifications are always delivered.
          </Text>

          {loadState === 'cached' && (
            <View style={styles.cacheBanner} testID="banner-cached-prefs">
              <Text style={styles.cacheBannerText}>
                Showing your last saved preferences — connect to sync the latest.
              </Text>
            </View>
          )}

          {/* Master toggle */}
          <View style={styles.masterCard} testID="row-notif-master-toggle">
            <View style={styles.masterInfo}>
              <Text style={styles.masterLabel}>Pause all push notifications</Text>
              <Text style={styles.masterDescription}>
                {isPaused
                  ? 'Push notifications are paused. Your category settings are saved.'
                  : 'Quickly silence all push notifications without losing your settings.'}
              </Text>
            </View>
            <Switch
              value={isPaused}
              onValueChange={(val) => handleToggle('pushPaused', val)}
              trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
              thumbColor="#FFFFFF"
              disabled={saving === 'pushPaused'}
              testID="switch-notif-master-toggle"
            />
          </View>

          {/* Per-category toggles */}
          {PREFERENCE_SECTIONS.map((section) => (
            <View key={section.title} style={isPaused && styles.sectionDimmed}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.section}>
                {section.items.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.toggleRow,
                      index < section.items.length - 1 && styles.toggleRowBorder,
                    ]}
                    testID={`row-notif-pref-${item.key}`}
                  >
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, isPaused && styles.dimmedText]}>{item.label}</Text>
                      <Text style={[styles.toggleDescription, isPaused && styles.dimmedText]}>{item.description}</Text>
                    </View>
                    <Switch
                      value={prefs[item.key] as boolean}
                      onValueChange={(val) => handleToggle(item.key, val)}
                      trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
                      thumbColor="#FFFFFF"
                      disabled={isPaused || saving === item.key}
                      testID={`switch-notif-pref-${item.key}`}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const skeletonStyles = StyleSheet.create({
  introBanner: {
    height: 16,
    width: '80%',
    borderRadius: 8,
    backgroundColor: Colors.neutral.lightSilver,
    marginBottom: Spacing.lg,
    opacity: 0.6,
  },
  sectionHeader: {
    height: 12,
    width: 64,
    borderRadius: 6,
    backgroundColor: Colors.neutral.lightSilver,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    marginLeft: Spacing.xs,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  textGroup: {
    flex: 1,
    gap: 6,
  },
  labelBar: {
    height: 14,
    width: '55%',
    borderRadius: 7,
    backgroundColor: Colors.neutral.lightSilver,
    opacity: 0.7,
  },
  descBar: {
    height: 11,
    width: '80%',
    borderRadius: 6,
    backgroundColor: Colors.neutral.lightSilver,
    opacity: 0.45,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: Colors.neutral.lightSilver,
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  intro: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  cacheBanner: {
    backgroundColor: '#FFF8E7',
    borderRadius: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#F0D080',
  },
  cacheBannerText: {
    fontSize: Typography.sizes.xs,
    color: '#7A5C00',
    lineHeight: 17,
  },
  masterCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  masterInfo: {
    flex: 1,
  },
  masterLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  masterDescription: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    lineHeight: 17,
  },
  sectionHeader: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    ...CardShadow,
  },
  sectionDimmed: {
    opacity: 0.45,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  toggleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    lineHeight: 17,
  },
  dimmedText: {
    color: Colors.text.tertiary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  errorTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.brand.primary,
    borderRadius: 24,
  },
  retryLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
