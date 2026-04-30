import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import apiService from '../../services/api.service';

type Prefs = {
  bubbleActivity: boolean;
  eventActivity: boolean;
  eventReminders: boolean;
  taskReminders: boolean;
  waitlistUpdates: boolean;
  announcements: boolean;
};

const DEFAULT_PREFS: Prefs = {
  bubbleActivity: true,
  eventActivity: true,
  eventReminders: true,
  taskReminders: true,
  waitlistUpdates: true,
  announcements: true,
};

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
        description: '24-hour and 1-hour reminders for events you\'re attending',
      },
      {
        key: 'taskReminders' as keyof Prefs,
        label: 'Task reminders',
        description: 'Reminders for volunteer tasks you\'ve signed up for',
      },
    ],
  },
  {
    title: 'Other',
    items: [
      {
        key: 'waitlistUpdates' as keyof Prefs,
        label: 'Waitlist updates',
        description: 'When your waitlist position changes or you\'re approved',
      },
      {
        key: 'announcements' as keyof Prefs,
        label: 'Announcements & messages',
        description: 'Admin announcements and direct messages',
      },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<any>();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  useEffect(() => {
    apiService.getNotificationPreferences()
      .then((data) => {
        setPrefs({
          bubbleActivity: data.bubbleActivity ?? true,
          eventActivity: data.eventActivity ?? true,
          eventReminders: data.eventReminders ?? true,
          taskReminders: data.taskReminders ?? true,
          waitlistUpdates: data.waitlistUpdates ?? true,
          announcements: data.announcements ?? true,
        });
      })
      .catch(() => {
        Alert.alert(
          'Could not load preferences',
          'Your saved notification preferences could not be loaded. Showing defaults — changes you make will still be saved.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(async (key: keyof Prefs, value: boolean) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);
    try {
      await apiService.updateNotificationPreferences({ [key]: value });
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      Alert.alert('Could not save', 'Your preference could not be saved. Please check your connection and try again.');
    } finally {
      setSaving(null);
    }
  }, [prefs]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Notification Preferences" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
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

          {PREFERENCE_SECTIONS.map((section) => (
            <View key={section.title}>
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
                      <Text style={styles.toggleLabel}>{item.label}</Text>
                      <Text style={styles.toggleDescription}>{item.description}</Text>
                    </View>
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={(val) => handleToggle(item.key, val)}
                      trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
                      thumbColor="#FFFFFF"
                      disabled={saving === item.key}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});
