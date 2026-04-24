import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { NavHeader } from '../../components/ScreenHeader';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import apiService from '../../services/api.service';

export type MemberProfileStackParamList = {
  MemberProfile: { userId: string };
};

type Props = {
  navigation: NativeStackNavigationProp<MemberProfileStackParamList, 'MemberProfile'>;
  route: RouteProp<MemberProfileStackParamList, 'MemberProfile'>;
};

type PublicProfile = {
  id: string;
  name: string;
  profilePhoto: string | null;
};

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

export default function MemberProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService
      .getUserPublicProfile(userId)
      .then(setProfile)
      .catch(() => setError('Could not load profile.'))
      .finally(() => setIsLoading(false));
  }, [userId]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader
        title="Profile"
        onBack={() => navigation.goBack()}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      ) : error || !profile ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Profile not found.'}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.profileCard, CardShadow]}>
            {profile.profilePhoto ? (
              <Image source={{ uri: profile.profilePhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
              </View>
            )}
            <Text style={styles.userName} testID="text-member-name">{profile.name}</Text>
            <Text style={styles.userRole}>Member</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.coolMist,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  profileCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    marginBottom: 15,
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.brand.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.skyWhite,
  },
  userName: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
});
