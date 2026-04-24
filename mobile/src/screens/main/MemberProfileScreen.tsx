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
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';
import apiService from '../../services/api.service';

export type MemberProfileStackParamList = {
  MemberProfile: { userId: string };
};

type Props = {
  navigation: NativeStackNavigationProp<MemberProfileStackParamList, 'MemberProfile'>;
  route: RouteProp<MemberProfileStackParamList, 'MemberProfile'>;
};

type SharedBubble = {
  id: string;
  title: string;
  coverImage: string | null;
  category: string;
};

type PublicProfile = {
  id: string;
  name: string;
  profilePhoto: string | null;
  aboutMe: string | null;
  interests: string[];
  sharedBubbles: SharedBubble[];
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
          {/* Avatar & Name Card */}
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

            {profile.aboutMe ? (
              <Text style={styles.aboutMe} testID="text-member-about">{profile.aboutMe}</Text>
            ) : null}
          </View>

          {/* Interests */}
          {profile.interests.length > 0 && (
            <View style={[styles.sectionCard, CardShadow]}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.tagsRow}>
                {profile.interests.map((interest) => (
                  <View key={interest} style={styles.interestTag} testID={`tag-interest-${interest}`}>
                    <Text style={styles.interestTagText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Shared Bubbles */}
          {profile.sharedBubbles.length > 0 && (
            <View style={[styles.sectionCard, CardShadow]}>
              <Text style={styles.sectionTitle}>Bubbles in Common</Text>
              {profile.sharedBubbles.map((bubble) => (
                <View key={bubble.id} style={styles.bubbleRow} testID={`row-shared-bubble-${bubble.id}`}>
                  {bubble.coverImage ? (
                    <Image source={{ uri: bubble.coverImage }} style={styles.bubbleThumb} />
                  ) : (
                    <View style={styles.bubbleThumbPlaceholder}>
                      <Text style={styles.bubbleThumbInitial}>
                        {bubble.title.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.bubbleInfo}>
                    <Text style={styles.bubbleTitle} numberOfLines={1} testID={`text-bubble-title-${bubble.id}`}>
                      {bubble.title}
                    </Text>
                    <Text style={styles.bubbleCategory} numberOfLines={1}>
                      {bubble.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
    gap: 12,
  },
  profileCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
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
  aboutMe: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: Colors.background.brandTint,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  interestTagText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    color: Colors.brand.primary,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  bubbleThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    marginRight: 12,
  },
  bubbleThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    marginRight: 12,
    backgroundColor: Colors.background.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleThumbInitial: {
    fontSize: Typography.sizes.base,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
  },
  bubbleInfo: {
    flex: 1,
  },
  bubbleTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  bubbleCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
});
