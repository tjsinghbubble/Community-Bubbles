import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NavHeader } from '../../components/ScreenHeader';
import apiService from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

const APP_STAGE = 'alpha';
const LOCAL_VERSION = Constants.expoConfig?.version ?? null;
const EXPO_SDK = String(Constants.expoConfig?.extra?.expoSdkVersion ?? '55');
const COMETCHAT_SDK = String(Constants.expoConfig?.extra?.cometChatVersion ?? '4.0.10');
const APP_ENV = String(Constants.expoConfig?.extra?.appEnv ?? 'development');
const BUILD_NUMBER: string | null = Constants.expoConfig?.extra?.buildNumber ?? null;

function isNewerVersion(serverVer: string, localVer: string): boolean {
  const toParts = (v: string): number[] => {
    const parts = v.split('-')[0].split('.').map((n) => {
      const parsed = parseInt(n, 10);
      return isNaN(parsed) ? 0 : parsed;
    });
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const sParts = toParts(serverVer);
  const lParts = toParts(localVer);
  for (let i = 0; i < Math.max(sParts.length, lParts.length); i++) {
    const s = sParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (s !== l) return s > l;
  }
  return false;
}

type HealthData = {
  version: string;
  env: string;
  uptime: string;
  services: {
    database: { status: string; latency_ms: number | null };
    storage: { status: string; latency_ms: number | null };
    third_party_auth: { status: string };
  };
};

function SysRow({
  label,
  value,
  good,
  mono,
  last,
}: {
  label: string;
  value: string;
  good?: boolean;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.sysRow, !last && styles.sysRowBorder]}>
      <Text style={styles.sysRowLabel}>{label}</Text>
      <Text
        style={[
          styles.sysRowValue,
          mono && styles.sysRowMono,
          good === true && styles.sysRowGood,
          good === false && styles.sysRowBad,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [appVersion, setAppVersion] = useState<string | null>(LOCAL_VERSION);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  useEffect(() => {
    apiService.getAppVersion()
      .then((res) => {
        if (LOCAL_VERSION && isNewerVersion(res.version, LOCAL_VERSION)) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {
        // Server unreachable — no update banner shown
      });
  }, []);

  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    fetch(`${API_URL}/api/v1/health`)
      .then((r) => r.json())
      .then(setHealthData)
      .catch(() => {});
  }, [user?.isSuperAdmin]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Account Settings" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('PersonalInformation')}
            testID="button-personal-info"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Personal Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('LoginSecurity')}
            testID="button-login-security"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Login & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('PrivacySettings')}
            testID="button-privacy"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('NotificationPreferences')}
            testID="button-notification-preferences"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Notification Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.versionSeparator} />

        {updateAvailable && (
          <View style={styles.updateBanner} testID="banner-update-available">
            <Ionicons name="arrow-up-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.updateBannerText}>A newer version is available — please update</Text>
          </View>
        )}

        <Text style={styles.versionText} testID="text-version">
          {appVersion ? `Version ${appVersion}, ${APP_STAGE}` : `Version unavailable, ${APP_STAGE}`}
        </Text>

        {user?.isSuperAdmin && (
          <View style={styles.sysSection}>
            <Text style={styles.sysSectionLabel}>System Info</Text>
            <View style={styles.sysCard}>
              <SysRow label="App env" value={APP_ENV} />
              <SysRow label="Server env" value={healthData?.env ?? '—'} />
              <SysRow label="Server version" value={healthData ? `v${healthData.version}` : '—'} />
              <SysRow label="App build" value={BUILD_NUMBER ?? '—'} />
              <SysRow label="Expo SDK" value={`SDK ${EXPO_SDK}`} />
              <SysRow label="CometChat SDK" value={`v${COMETCHAT_SDK}`} />
              <SysRow label="API URL" value={API_URL} mono />
              <SysRow label="Uptime" value={healthData?.uptime ?? '—'} />
              <SysRow
                label="Database"
                value={
                  healthData
                    ? healthData.services.database.status === 'up'
                      ? `up · ${healthData.services.database.latency_ms ?? '?'}ms`
                      : 'down'
                    : '—'
                }
                good={healthData ? healthData.services.database.status === 'up' : undefined}
              />
              <SysRow
                label="CometChat"
                value={
                  healthData
                    ? healthData.services.third_party_auth.status === 'up'
                      ? 'reachable'
                      : healthData.services.third_party_auth.status
                    : '—'
                }
                good={healthData ? healthData.services.third_party_auth.status === 'up' : undefined}
                last
              />
            </View>
          </View>
        )}
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
    paddingVertical: Spacing.md,
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
  versionSeparator: {
    height: 1,
    backgroundColor: '#D9D9D9',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.brand.primary,
    borderRadius: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  updateBannerText: {
    fontSize: Typography.sizes.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  versionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  sysSection: {
    marginTop: Spacing.lg,
  },
  sysSectionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  sysCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    overflow: 'hidden',
    ...CardShadow,
  },
  sysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  sysRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sysRowLabel: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },
  sysRowValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.primary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  sysRowMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: Typography.sizes.xs,
  },
  sysRowGood: {
    color: '#10B981',
  },
  sysRowBad: {
    color: '#E8453C',
  },
});
