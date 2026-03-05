import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CreateBubbleEventIcon } from '../../components/icons';
import apiService from '../../services/api.service';
import BubbleButton from '../../components/BubbleButton';
import { Colors, Spacing, Radius, Typography, Gradients, NotificationBadge } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;

type Bubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  members: number;
  coverImage: string | null;
  distance: string | null;
  creatorId?: string;
  role?: string;
  status?: 'pending' | 'approved' | 'rejected';
};

export default function MyBubblesScreen() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [createdBubbles, setCreatedBubbles] = useState<Bubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const fetchData = async () => {
    try {
      let bubblesData: Bubble[] = [];
      let createdBubblesData: Bubble[] = [];

      try {
        bubblesData = await apiService.getMyBubbles() as Bubble[];
      } catch (err) {
        console.error('[MyBubbles] getMyBubbles FAILED:', err);
      }

      try {
        createdBubblesData = await apiService.getMyCreatedBubbles() as Bubble[];
      } catch (err) {
        console.error('[MyBubbles] getMyCreatedBubbles FAILED:', err);
      }

      setBubbles(bubblesData);
      setCreatedBubbles(createdBubblesData);
    } catch (error) {
      console.error('[MyBubbles] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBubblePress = (bubble: Bubble) => {
    navigation.navigate('Explore', {
      screen: 'BubbleDetails',
      params: {
        bubble: {
          id: bubble.id,
          title: bubble.title,
          tagline: bubble.tagline,
          category: bubble.category,
          members: bubble.members,
          image: bubble.coverImage,
          distance: bubble.distance,
        },
      },
    });
  };

  const handleCreateBubble = () => {
    navigation.navigate('CreateBubble' as never);
  };

  const pendingOrRejectedBubbles = createdBubbles.filter(
    b => b.status === 'pending' || b.status === 'rejected'
  );
  const joinedBubbleIds = new Set(bubbles.map(b => b.id));
  const displayBubbles = [
    ...pendingOrRejectedBubbles.filter(b => !joinedBubbleIds.has(b.id)),
    ...bubbles,
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>My Bubbles</Text>
        <TouchableOpacity style={styles.bellButton} onPress={() => (navigation as any).navigate('Notifications')}>
          <View>
            <Ionicons name="notifications-outline" size={24} color={Colors.text.primary} />
            {unreadNotifCount > 0 && (
              <View style={NotificationBadge.badge}>
                <Text style={NotificationBadge.badgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {displayBubbles.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={40} color={Colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>No bubbles yet</Text>
          <Text style={styles.emptySubtitle}>
            Join some bubbles from the Explore tab or create your own!
          </Text>
          <BubbleButton
            title="Create a Bubble"
            onPress={handleCreateBubble}
            style={styles.createFirstButton}
            icon={<Ionicons name="add" size={20} color={'#FFFFFF'} />}
            testID="button-create-bubble-empty"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.gridList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.gridContainer}>
            {displayBubbles.map((bubble) => (
              <AnimatedPressable
                key={bubble.id}
                style={styles.gridCard}
                scaleValue={0.95}
                onPress={() => handleBubblePress(bubble)}
              >
                <View style={styles.gridImageContainer}>
                  <Image
                    source={{
                      uri: bubble.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400',
                    }}
                    style={styles.gridImage}
                  />
                  {bubble.status === 'pending' ? (
                    <View style={styles.gridPendingBadge}>
                      <Text style={styles.gridPendingText}>Pending</Text>
                    </View>
                  ) : bubble.status === 'rejected' ? (
                    <View style={styles.gridRejectedBadge}>
                      <Text style={styles.gridRejectedText}>Rejected</Text>
                    </View>
                  ) : (
                    <View style={styles.gridCategoryBadge}>
                      <Text style={styles.gridCategoryText}>{bubble.category}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gridTitle} numberOfLines={1}>{bubble.title}</Text>
                <Text style={styles.gridRole}>
                  {bubble.role === 'admin' ? 'Admin' : 'Member'}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity onPress={handleCreateBubble} style={styles.fab} activeOpacity={0.8}>
        <CreateBubbleEventIcon size={56} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.brandTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.base,
  },
  gridList: {
    padding: CARD_PADDING,
    paddingBottom: 100,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
  gridImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.neutral.coolMist,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(245, 246, 248, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  gridCategoryText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#1E1F26',
    textAlign: 'center',
  },
  gridPendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(245, 246, 248, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  gridPendingText: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.status.warning,
    textAlign: 'center',
  },
  gridRejectedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(245, 246, 248, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  gridRejectedText: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.status.error,
    textAlign: 'center',
  },
  gridTitle: {
    fontSize: Typography.sizes.base + 1,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  gridRole: {
    fontSize: Typography.sizes.sm + 2,
    color: Colors.text.tertiary,
    marginTop: Spacing.xxs,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: 20,
    gap: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
