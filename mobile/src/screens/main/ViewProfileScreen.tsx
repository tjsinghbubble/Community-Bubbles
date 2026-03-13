import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'ViewProfile'>;
};

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

type BubbleItem = {
  id: string;
  title: string;
  category?: string;
  coverImage?: string | null;
};

export default function ViewProfileScreen({ navigation }: Props) {
  const { user, token } = useAuth();
  const [myBubbles, setMyBubbles] = useState<BubbleItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        apiService.setToken(token);
        apiService.getMyBubbles().then((bubbles: any) => {
          setMyBubbles(bubbles || []);
        }).catch(() => {});
      }
    }, [token])
  );

  if (!user) return null;

  const previewBubbles = myBubbles.slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="button-back-view-profile"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.editHeaderBtn}
          onPress={() => navigation.navigate('EditProfile')}
          testID="button-edit-header"
        >
          <Text style={styles.editHeaderText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.separator} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.profileCard, CARD_SHADOW]}>
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
        </View>

        <View style={styles.completeSection}>
          <Text style={styles.completeTitle}>Complete your profile</Text>
          <Text style={styles.completeSubtitle}>
            Your Bubble profile is an important part of every community. Complete yours to help other admins and members get to know you.
          </Text>

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

        <TouchableOpacity
          style={[styles.bubblesCard, CARD_SHADOW]}
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.background.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
  },
  editHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.bubbleBlue + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: Typography.weights.bold as any,
    color: Colors.brand.bubbleBlue,
  },
  userName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
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
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
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
    color: Colors.neutral.coolMist,
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
    color: Colors.neutral.coolMist,
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
