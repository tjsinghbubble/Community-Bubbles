import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BubbleWaitlist'>;
  route: RouteProp<ExploreStackParamList, 'BubbleWaitlist'>;
};

type WaitlistMember = {
  id: string;
  userId: string;
  bubbleId: string;
  membershipStatus: 'waitlisted' | 'on_hold';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profilePhoto?: string | null;
  };
};

export default function BubbleWaitlistScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle } = route.params;
  const [waitlist, setWaitlist] = useState<WaitlistMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchWaitlist();
    }, [bubbleId])
  );

  const fetchWaitlist = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getWaitlist(bubbleId);
      setWaitlist(data as WaitlistMember[]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load waitlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId: string, userName: string) => {
    Alert.alert(
      'Approve Member',
      `Let ${userName} join the bubble from the waitlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiService.approveWaitlist(bubbleId, userId);
              setWaitlist(prev => prev.filter(m => m.userId !== userId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleHold = async (userId: string, userName: string) => {
    Alert.alert(
      'Put On Hold',
      `Put ${userName}'s waitlist spot on hold? They will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hold',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiService.holdWaitlist(bubbleId, userId);
              setWaitlist(prev =>
                prev.map(m =>
                  m.userId === userId ? { ...m, membershipStatus: 'on_hold' } : m
                )
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to put on hold');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (userId: string, userName: string) => {
    Alert.alert(
      'Remove From Waitlist',
      `Remove ${userName} from the waitlist? They will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiService.rejectWaitlist(bubbleId, userId);
              setWaitlist(prev => prev.filter(m => m.userId !== userId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: WaitlistMember }) => {
    const isOnHold = item.membershipStatus === 'on_hold';
    const isActing = actionLoading === item.userId;

    return (
      <View style={styles.card} testID={`card-waitlist-${item.userId}`}>
        <View style={styles.cardLeft}>
          {item.user.profilePhoto ? (
            <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(item.user.name || item.user.email)}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.user.name || item.user.email}</Text>
            <Text style={styles.joinedDate}>Joined {formatDate(item.joinedAt)}</Text>
            {isOnHold && (
              <View style={styles.holdBadge}>
                <Text style={styles.holdBadgeText}>On Hold</Text>
              </View>
            )}
          </View>
        </View>
        {isActing ? (
          <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApprove(item.userId, item.user.name || item.user.email)}
              testID={`button-approve-${item.userId}`}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            {!isOnHold && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.holdBtn]}
                onPress={() => handleHold(item.userId, item.user.name || item.user.email)}
                testID={`button-hold-${item.userId}`}
                activeOpacity={0.7}
              >
                <Ionicons name="pause" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item.userId, item.user.name || item.user.email)}
              testID={`button-reject-${item.userId}`}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="button-back"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Waitlist</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.headerSeparator} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      ) : waitlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No one on the waitlist</Text>
          <Text style={styles.emptySubtitle}>
            When the bubble is full, members who want to join will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={waitlist}
          keyExtractor={item => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.countText}>
              {waitlist.length} {waitlist.length === 1 ? 'person' : 'people'} waiting
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  headerSpacer: {
    width: 32,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.md,
  },
  listContent: {
    padding: Spacing.lg,
  },
  countText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  separator: {
    height: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...CardShadow,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.sm,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarInitials: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as any,
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  joinedDate: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  holdBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.status.warning,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  holdBadgeText: {
    fontSize: Typography.sizes.xxs,
    fontWeight: Typography.weights.semiBold as any,
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: Colors.status.success,
  },
  holdBtn: {
    backgroundColor: Colors.status.warning,
  },
  rejectBtn: {
    backgroundColor: Colors.status.error,
  },
});
