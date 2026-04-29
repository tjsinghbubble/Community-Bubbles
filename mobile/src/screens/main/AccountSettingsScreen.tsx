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

export default function AccountSettingsScreen() {
  const navigation = useNavigation<any>();
  const [appVersion, setAppVersion] = useState<string | null>(LOCAL_VERSION);

  useEffect(() => {
    apiService.getAppVersion()
      .then((res) => setAppVersion(res.version))
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
  versionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
