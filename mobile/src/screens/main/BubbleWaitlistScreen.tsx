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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import apiService, { WaitlistMemberRecord, JoinRequestMember } from '../../services/api.service';
import { Colors, Spacing, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BubbleWaitlist'>;
  route: RouteProp<ExploreStackParamList, 'BubbleWaitlist'>;
};

type DenyModalState = {
  visible: boolean;
  userId: string;
  userName: string;
  reason: string;
};

export default function BubbleWaitlistScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle, onPendingCountChange } = route.params;
  const [waitlist, setWaitlist] = useState<WaitlistMemberRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denyModal, setDenyModal] = useState<DenyModalState>({
    visible: false,
    userId: '',
    userName: '',
    reason: '',
  });

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [bubbleId])
  );

  const fetchAll = async () => {
    setIsLoading(true);

    const [waitlistResult, joinResult] = await Promise.allSettled([
      apiService.getWaitlist(bubbleId),
      apiService.getJoinRequests(bubbleId),
    ]);

    if (waitlistResult.status === 'fulfilled') {
      const { waitlisted = [], on_hold = [] } = waitlistResult.value;
      setWaitlist([...waitlisted, ...on_hold]);
    } else {
      Alert.alert('Error', (waitlistResult.reason as Error)?.message || 'Failed to load waitlist');
    }

    if (joinResult.status === 'fulfilled') {
      setJoinRequests(joinResult.value);
      onPendingCountChange?.(joinResult.value.length);
    } else {
      Alert.alert('Error', (joinResult.reason as Error)?.message || 'Failed to load join requests');
    }

    setIsLoading(false);
  };

  const handleApproveWaitlist = (userId: string, userName: string) => {
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

  const handleRejectWaitlist = (userId: string, userName: string) => {
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

  const handleApproveJoinRequest = (userId: string, userName: string) => {
    Alert.alert(
      'Approve Request',
      `Let ${userName} join the bubble?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiService.approveJoinRequest(bubbleId, userId);
              setJoinRequests(prev => {
                const updated = prev.filter(r => r.userId !== userId);
                onPendingCountChange?.(updated.length);
                return updated;
              });
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

  const openDenyModal = (userId: string, userName: string) => {
    setDenyModal({ visible: true, userId, userName, reason: '' });
  };

  const closeDenyModal = () => {
    setDenyModal(prev => ({ ...prev, visible: false, reason: '' }));
  };

  const handleConfirmDeny = async () => {
    const { userId, reason } = denyModal;
    closeDenyModal();
    setActionLoading(userId);
    try {
      await apiService.rejectJoinRequest(bubbleId, userId, reason.trim() || undefined);
      setJoinRequests(prev => {
        const updated = prev.filter(r => r.userId !== userId);
        onPendingCountChange?.(updated.length);
        return updated;
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to deny request');
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const totalPending = waitlist.length + joinRequests.length;

  const renderWaitlistCard = (item: WaitlistMemberRecord) => {
    const isActing = actionLoading === item.userId;
    const name = item.user.name || item.user.email || 'Unknown';
    const isOnHold = item.membershipStatus === 'on_hold';

    return (
      <View key={`waitlist-${item.userId}`} style={styles.memberCard} testID={`card-waitlist-${item.userId}`}>
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
              onPress={() => handleApproveWaitlist(item.userId, name)}
              activeOpacity={0.7}
              testID={`button-approve-waitlist-${item.userId}`}
            >
              <Ionicons name="checkmark" size={18} color="#34C759" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleRejectWaitlist(item.userId, name)}
              activeOpacity={0.7}
              testID={`button-reject-waitlist-${item.userId}`}
            >
              <Ionicons name="close" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderJoinRequestCard = (item: JoinRequestMember) => {
    const isActing = actionLoading === item.userId;
    const name = item.user.name || item.user.email || 'Unknown';

    return (
      <View key={`join-${item.userId}`} style={styles.memberCard} testID={`card-joinrequest-${item.userId}`}>
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
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Join Request</Text>
            </View>
          </View>
        </View>

        {isActing ? (
          <ActivityIndicator size="small" color={Colors.brand.primary} style={styles.activityIndicator} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApproveJoinRequest(item.userId, name)}
              activeOpacity={0.7}
              testID={`button-approve-joinrequest-${item.userId}`}
            >
              <Ionicons name="checkmark" size={18} color="#34C759" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => openDenyModal(item.userId, name)}
              activeOpacity={0.7}
              testID={`button-deny-joinrequest-${item.userId}`}
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
      <NavHeader title="Waitlist & Requests" onBack={() => navigation.goBack()} />

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
            <View style={styles.statCard} testID="stat-pending">
              <Text style={styles.statNumber}>{totalPending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard} testID="stat-joinrequests">
              <Text style={styles.statNumber}>{joinRequests.length}</Text>
              <Text style={styles.statLabel}>Requests</Text>
            </View>
            <View style={styles.statCard} testID="stat-waitlisted">
              <Text style={styles.statNumber}>{waitlist.length}</Text>
              <Text style={styles.statLabel}>Waitlisted</Text>
            </View>
          </View>

          {joinRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Join Requests</Text>
              <View style={styles.separator} />
              <View style={styles.memberList}>
                {joinRequests.map(renderJoinRequestCard)}
              </View>
            </>
          )}

          {waitlist.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, joinRequests.length > 0 && styles.sectionTitleSpaced]}>
                Waitlist
              </Text>
              <View style={styles.separator} />
              <View style={styles.memberList}>
                {waitlist.map(renderWaitlistCard)}
              </View>
            </>
          )}

          {totalPending === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                Join requests and waitlisted members will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={denyModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDenyModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Deny Join Request</Text>
            <Text style={styles.modalSubtitle}>
              Deny <Text style={styles.modalUserName}>{denyModal.userName}</Text>'s request to join?
            </Text>

            <Text style={styles.reasonLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Let them know why their request was denied…"
              placeholderTextColor={Colors.text.tertiary}
              value={denyModal.reason}
              onChangeText={text => setDenyModal(prev => ({ ...prev, reason: text }))}
              multiline
              numberOfLines={3}
              maxLength={300}
              testID="input-deny-reason"
            />
            <Text style={styles.charCount}>{denyModal.reason.length}/300</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={closeDenyModal}
                activeOpacity={0.7}
                testID="button-deny-cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.denyBtn]}
                onPress={handleConfirmDeny}
                activeOpacity={0.7}
                testID="button-deny-confirm"
              >
                <Text style={styles.denyBtnText}>Deny</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sectionTitleSpaced: {
    marginTop: Spacing.xl,
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
  pendingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  pendingBadgeText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContainer: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    width: '100%',
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  modalUserName: {
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
  },
  reasonLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium as any,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  reasonInput: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: Typography.sizes.xxs,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cancelBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium as any,
    color: Colors.text.secondary,
  },
  denyBtn: {
    backgroundColor: '#FF3B30',
  },
  denyBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#FFFFFF',
  },
});
