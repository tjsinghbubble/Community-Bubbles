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

const APP_STAGE = 'alpha';
const LOCAL_VERSION = Constants.expoConfig?.version ?? null;

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

export default function AccountSettingsScreen() {
  const navigation = useNavigation<any>();
  const [appVersion, setAppVersion] = useState<string | null>(LOCAL_VERSION);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    apiService.getAppVersion()
      .then((res) => {
        setAppVersion(res.version);
        if (LOCAL_VERSION && isNewerVersion(res.version, LOCAL_VERSION)) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {
        // Server unreachable — keep the locally bundled version already in state
      });
  }, []);

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
});
