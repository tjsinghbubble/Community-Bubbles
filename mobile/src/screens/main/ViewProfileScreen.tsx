import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { FlowHeader } from '../../components/ScreenHeader';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'ViewProfile'>;
};

type CompletionHintRowProps = {
  label: string;
  hint: string;
  done: boolean;
  testID?: string;
  last?: boolean;
};

function CompletionHintRow({ label, hint, done, testID, last }: CompletionHintRowProps) {
  return (
    <View
      style={[hintRowStyles.row, !last && hintRowStyles.rowBorder]}
      testID={testID}
    >
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={done ? '#34C759' : '#C7C7CC'}
        style={hintRowStyles.icon}
        testID={done ? `${testID}-done` : `${testID}-missing`}
      />
      <View style={hintRowStyles.textBlock}>
        <Text style={[hintRowStyles.label, done && hintRowStyles.labelDone]}>{label}</Text>
        {!done && <Text style={hintRowStyles.hint}>{hint}</Text>}
      </View>
    </View>
  );
}

const hintRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  icon: {
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4D4D4D',
  },
  labelDone: {
    color: '#34C759',
  },
  hint: {
    fontSize: 12,
    color: '#969696',
    marginTop: 2,
  },
});


type BubbleItem = {
  id: string;
  title: string;
  category?: string;
  coverImage?: string | null;
  role?: string;
};

export default function ViewProfileScreen({ navigation }: Props) {
  const { user, token } = useAuth();
  const [myBubbles, setMyBubbles] = useState<BubbleItem[]>([]);
  const isBubbleAdmin = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        apiService.setToken(token);
        apiService.getMyBubbles().then((bubbles: any) => {
          const list = bubbles || [];
          setMyBubbles(list);
          isBubbleAdmin.current = list.some((b: any) => b.role === 'admin');
          logAppEvent('ViewProfile:bubblesLoaded', {
            bubblesCount: list.length,
            isBubbleAdmin: isBubbleAdmin.current,
          });
        }).catch((err: any) => {
          logAppWarn('ViewProfile:bubblesLoadFailed', { error: err?.message ?? 'unknown' });
        });
      }
    }, [token])
  );

  if (!user) return null;

  const isSuperAdmin = user.isSuperAdmin === true;
  const roleLabel = isSuperAdmin ? 'Super Admin' : isBubbleAdmin.current ? 'Admin' : 'Member';
  const previewBubbles = myBubbles.slice(0, 3);

  const isProfileComplete =
    !!user.aboutMe &&
    Array.isArray(user.interests) && user.interests.length > 0 &&
    !!user.profilePhoto;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlowHeader
        title="My Profile"
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} testID="button-edit-header">
            <Text style={styles.editHeaderText}>Edit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.profileCard, CardShadow]}>
          {user.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{roleLabel}</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
            testID="button-edit-bio"
          >
            <Text
              style={[styles.aboutMe, !user.aboutMe && styles.aboutMePlaceholder]}
              testID="text-my-about"
            >
              {user.aboutMe || 'Add a bio…'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isProfileComplete && (
          <View style={styles.completeSection} testID="section-complete-profile">
            <Text style={styles.completeTitle}>Complete your profile</Text>
            <Text style={styles.completeSubtitle}>
              Your Bubble profile is an important part of every community. Complete yours to help other admins and members get to know you.
            </Text>

            <View style={styles.hintList}>
              <CompletionHintRow
                label="Profile photo"
                hint="Add a photo so people can recognise you"
                done={!!user.profilePhoto}
                testID="hint-photo"
              />
              <CompletionHintRow
                label="Bio"
                hint="Tell people a little about yourself"
                done={!!user.aboutMe}
                testID="hint-bio"
              />
              <CompletionHintRow
                label="Interests"
                hint="Pick at least one interest"
                done={Array.isArray(user.interests) && user.interests.length > 0}
                testID="hint-interests"
                last
              />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.7}
              style={styles.getStartedBtn}
              testID="button-get-started"
            >
              <LinearGradient
                colors={['#35A8F7', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 3.6 }}
                style={styles.getStartedGradient}
              >
                <Text style={styles.getStartedText}>Get started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.bubblesCard, CardShadow]}
          onPress={() => navigation.navigate('MyBubblesFromProfile')}
          activeOpacity={0.7}
          testID="card-my-bubbles"
        >
          <View style={styles.bubblesCardHeader}>
            <Text style={styles.bubblesCardTitle}>My Bubbles</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
          {myBubbles.length === 0 ? (
            <Text style={styles.emptyText}>You haven't joined any bubbles yet.</Text>
          ) : (
            <>
              {previewBubbles.map((bubble) => (
                <View key={bubble.id} style={styles.bubbleRow}>
                  {bubble.coverImage ? (
                    <Image source={{ uri: bubble.coverImage }} style={styles.bubbleThumb} />
                  ) : (
                    <View style={[styles.bubbleThumb, styles.bubbleThumbPlaceholder]}>
                      <Ionicons name="people" size={16} color={Colors.brand.bubbleBlue} />
                    </View>
                  )}
                  <View style={styles.bubbleInfo}>
                    <Text style={styles.bubbleName}>{bubble.title}</Text>
                    {bubble.category && (
                      <Text style={styles.bubbleCategory}>{bubble.category}</Text>
                    )}
                  </View>
                </View>
              ))}
              {myBubbles.length > 3 && (
                <Text style={styles.seeAllText}>See all {myBubbles.length} bubbles</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  editHeaderText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
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
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 15,
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
  aboutMe: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  aboutMePlaceholder: {
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  completeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.regular as any,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  hintList: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  getStartedBtn: {
    width: '100%',
  },
  getStartedGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#1E1F26',
  },
  bubblesCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: 20,
  },
  bubblesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bubblesCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    fontStyle: 'italic',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  bubbleThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 12,
  },
  bubbleThumbPlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInfo: {
    flex: 1,
  },
  bubbleName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  bubbleCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
    textAlign: 'center',
    marginTop: 12,
  },
});
