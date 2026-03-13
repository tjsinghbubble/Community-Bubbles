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
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'MyBubblesFromProfile'>;
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
  memberCount?: number;
  role?: string;
};

export default function MyBubblesFromProfileScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        setLoading(true);
        apiService.setToken(token);
        apiService.getMyBubbles().then((data: any) => {
          setBubbles(data || []);
        }).catch(() => {
          setBubbles([]);
        }).finally(() => setLoading(false));
      }
    }, [token])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="button-back-my-bubbles"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bubbles</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <View style={styles.separator} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      ) : bubbles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={Colors.neutral.coolMist} />
          <Text style={styles.emptyTitle}>No bubbles yet</Text>
          <Text style={styles.emptySubtitle}>Join or create a bubble to see it here.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {bubbles.map((bubble) => (
            <View key={bubble.id} style={[styles.bubbleCard, CARD_SHADOW]}>
              {bubble.coverImage ? (
                <Image source={{ uri: bubble.coverImage }} style={styles.bubbleImage} />
              ) : (
                <View style={[styles.bubbleImage, styles.bubbleImagePlaceholder]}>
                  <Ionicons name="people" size={28} color={Colors.brand.bubbleBlue} />
                </View>
              )}
              <View style={styles.bubbleContent}>
                <Text style={styles.bubbleName}>{bubble.title}</Text>
                {bubble.category && (
                  <Text style={styles.bubbleCategory}>{bubble.category}</Text>
                )}
                <View style={styles.bubbleMeta}>
                  {bubble.role && (
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>
                        {bubble.role === 'admin' ? 'Admin' : 'Member'}
                      </Text>
                    </View>
                  )}
                  {bubble.memberCount !== undefined && (
                    <Text style={styles.memberCount}>
                      {bubble.memberCount} {bubble.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  )}
                </View>
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
  headerPlaceholder: {
    width: 40,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: 12,
  },
  bubbleCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
  },
  bubbleImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 14,
  },
  bubbleImagePlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: {
    flex: 1,
  },
  bubbleName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  bubbleCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  roleBadge: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
  },
  memberCount: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.coolMist,
  },
});
