import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography } from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

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
      const data = await apiService.getWaitlist(bubbleId) as any;
      const flat: WaitlistMember[] = [...(data.waitlisted ?? []), ...(data.on_hold ?? [])];
      setWaitlist(flat);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load waitlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = (userId: string, userName: string) => {
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

  const handleReject = (userId: string, userName: string) => {
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
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const pendingCount = waitlist.filter(m => m.membershipStatus === 'waitlisted').length;
  const onHoldCount = waitlist.filter(m => m.membershipStatus === 'on_hold').length;
  const totalPending = pendingCount + onHoldCount;

  const renderMemberCard = (item: WaitlistMember) => {
    const isActing = actionLoading === item.userId;
    const name = item.user.name || item.user.email;
    const isOnHold = item.membershipStatus === 'on_hold';

    return (
      <View key={item.userId} style={styles.memberCard}>
        <View style={styles.memberLeft}>
          {item.user.profilePhoto ? (
            <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            </View>
          )}
          <View style={styles.memberInfo}>
            <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
            {isOnHold && (
              <View style={styles.holdBadge}>
                <Text style={styles.holdBadgeText}>On Hold</Text>
              </View>
            )}
          </View>
        </View>

        {isActing ? (
          <ActivityIndicator size="small" color={Colors.brand.primary} style={styles.activityIndicator} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApprove(item.userId, name)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={18} color="#34C759" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item.userId, name)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Waitlist" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalPending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Accepted</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Denied</Text>
            </View>
          </View>

          {waitlist.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No one on the waitlist</Text>
              <Text style={styles.emptySubtitle}>
                When the bubble is full, members who want to join will appear here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Pending</Text>
              <View style={styles.separator} />
              <View style={styles.memberList}>
                {waitlist.map(renderMemberCard)}
              </View>
            </>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: Typography.weights.regular as any,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginBottom: Spacing.lg,
  },
  memberList: {
    gap: Spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarInitials: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium as any,
    color: Colors.text.primary,
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
  activityIndicator: {
    width: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  approveBtn: {
    borderColor: '#34C759',
  },
  rejectBtn: {
    borderColor: '#FF3B30',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
