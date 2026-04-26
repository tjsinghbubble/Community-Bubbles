import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import cometChatService from '../../services/cometchat.service';
import apiService from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';
import { MessagesStackParamList } from '../../navigation/MessagesNavigator';
import { Colors, Spacing, Radius, Typography, NotificationBadge, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';

type Conversation = {
  conversationId: string;
  conversationType: string;
  conversationWith: {
    guid: string;
    name: string;
    membersCount: number;
    icon?: string;
  };
  lastMessage?: {
    text?: string;
    sentAt: number;
    sender?: {
      name: string;
    };
  };
  unreadMessageCount: number;
};

type FilterTab = 'all' | 'bubbles' | 'dms';

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;
  route: RouteProp<MessagesStackParamList, 'MessagesList'>;
};

export default function MessagesScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bubbleImages, setBubbleImages] = useState<Record<string, string | null>>({});
  const [dmAvatarData, setDmAvatarData] = useState<Record<string, { memberPhoto: string | null; bubbleCover: string | null }>>({});
  const [approvedBubbleIds, setApprovedBubbleIds] = useState<Set<string>>(new Set());
  const [deletedContactBubbleIds, setDeletedContactBubbleIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [onlinePeerUids, setOnlinePeerUids] = useState<Set<string>>(new Set());
  const peerUidByGuid = React.useRef<Record<string, string>>({});
  const hasAutoNavigated = React.useRef(false);

  const fetchBubbleImages = async (convs: Conversation[]) => {
    const imageMap: Record<string, string | null> = {};
    const dmData: Record<string, { memberPhoto: string | null; bubbleCover: string | null }> = {};
    const deletedBubbles = new Set<string>();
    const initialOnlineUids: string[] = [];
    const fetchPromises = convs.map(async (conv) => {
      const guid = conv.conversationWith.guid;
      if (conv.conversationWith.icon) {
        imageMap[guid] = conv.conversationWith.icon;
        return;
      }

      const isPeerDm = guid.startsWith('peer_');
      if (isPeerDm) {
        const peerMatch = guid.match(/^peer_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (peerMatch) {
          const otherUserId = peerMatch[1] === String(user?.id) ? peerMatch[2] : peerMatch[1];
          peerUidByGuid.current[guid] = otherUserId;
          let memberPhoto: string | null = null;
          try {
            const profile = await apiService.getUserPublicProfile(otherUserId) as any;
            if (profile?.profilePhoto) memberPhoto = profile.profilePhoto;
          } catch {}
          dmData[guid] = { memberPhoto, bubbleCover: null };
          imageMap[guid] = memberPhoto;
          try {
            const { status } = await cometChatService.getPeerUser(otherUserId);
            if (status === 'online') {
              initialOnlineUids.push(otherUserId);
            }
          } catch {}
        } else {
          imageMap[guid] = null;
        }
        return;
      }

      const isAdminDm = guid.startsWith('adm_');
      if (isAdminDm) {
        const dmMatch = guid.match(/^adm_(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (dmMatch) {
          const bubbleId = dmMatch[1];
          const memberId = dmMatch[2];
          let memberPhoto: string | null = null;
          let bubbleCover: string | null = null;
          try {
            const members = await apiService.getBubbleMembers(bubbleId) as any[];
            const targetMember = members.find((m: any) => String(m.userId) === memberId);
            if (targetMember?.user?.profilePhoto) {
              memberPhoto = targetMember.user.profilePhoto;
            }
          } catch {}
          try {
            const bubble = await apiService.getBubble(bubbleId) as any;
            if (bubble?.coverImage) {
              bubbleCover = bubble.coverImage;
            } else if (bubble?.images?.length > 0) {
              bubbleCover = bubble.images[0];
            }
          } catch {}
          dmData[guid] = { memberPhoto, bubbleCover };
          imageMap[guid] = memberPhoto;
          peerUidByGuid.current[guid] = memberId;
          try {
            const { status } = await cometChatService.getPeerUser(memberId);
            if (status === 'online') {
              initialOnlineUids.push(memberId);
            }
          } catch {}
        } else {
          imageMap[guid] = null;
        }
        return;
      }

      const isContactGroup = guid.startsWith('contact_');
      if (isContactGroup) {
        const contactMatch = guid.match(/^contact_(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (contactMatch) {
          const bubbleId = contactMatch[1];
          const userId = contactMatch[2];
          let memberPhoto: string | null = null;
          let bubbleCover: string | null = null;
          try {
            const members = await apiService.getBubbleMembers(bubbleId) as any[];
            const targetMember = members.find((m: any) => String(m.userId) === userId);
            if (targetMember?.user?.profilePhoto) {
              memberPhoto = targetMember.user.profilePhoto;
            }
          } catch {}
          try {
            const bubble = await apiService.getBubble(bubbleId) as any;
            if (bubble?.coverImage) {
              bubbleCover = bubble.coverImage;
            } else if (bubble?.images?.length > 0) {
              bubbleCover = bubble.images[0];
            }
          } catch (err: any) {
            if (err?.status === 404) {
              deletedBubbles.add(bubbleId);
            }
          }
          dmData[guid] = { memberPhoto, bubbleCover };
          imageMap[guid] = memberPhoto;
          peerUidByGuid.current[guid] = userId;
          try {
            const { status } = await cometChatService.getPeerUser(userId);
            if (status === 'online') {
              initialOnlineUids.push(userId);
            }
          } catch {}
        } else {
          imageMap[guid] = null;
        }
        return;
      }

      try {
        const bubble = await apiService.getBubble(guid) as any;
        if (bubble?.coverImage) {
          imageMap[guid] = bubble.coverImage;
        } else if (bubble?.images?.length > 0) {
          imageMap[guid] = bubble.images[0];
        } else {
          imageMap[guid] = null;
        }
      } catch {
        imageMap[guid] = null;
      }
    });
    await Promise.all(fetchPromises);
    setBubbleImages(prev => ({ ...prev, ...imageMap }));
    setDmAvatarData(prev => ({ ...prev, ...dmData }));
    if (initialOnlineUids.length > 0) {
      setOnlinePeerUids(prev => new Set([...prev, ...initialOnlineUids]));
    }
    if (deletedBubbles.size > 0) {
      setDeletedContactBubbleIds(prev => new Set([...prev, ...deletedBubbles]));
    }
  };

  const fetchConversations = async () => {
    setDeletedContactBubbleIds(new Set());
    setBubbleImages({});
    setDmAvatarData({});
    try {
      if (user) await cometChatService.ensureLoggedIn(user.id, user.name);

      cometChatService.buildConversationsRequest(30);

      const [{ conversations: firstPage, hasMore: more }, myBubbles] = await Promise.all([
        cometChatService.fetchConversationsPage(),
        apiService.getMyBubbles().catch(() => []),
      ]);

      const ids = new Set<string>((myBubbles as any[]).map((b: any) => String(b.id)));
      setApprovedBubbleIds(ids);

      const convs = firstPage as unknown as Conversation[];
      setConversations(convs);
      setHasMore(more);
      fetchBubbleImages(convs);
      logAppEvent('[Screen] MessagesScreen conversations loaded', { conversationCount: convs.length });
    } catch (error) {
      logAppWarn('[Screen] MessagesScreen conversations fetch failed', { error: String(error) });
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreConversations = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { conversations: nextPage, hasMore: more } = await cometChatService.fetchConversationsPage();
      const convs = nextPage as unknown as Conversation[];
      setConversations(prev => [...prev, ...convs]);
      setHasMore(more);
      fetchBubbleImages(convs);
    } catch (error) {
      console.error('Failed to load more conversations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  React.useEffect(() => {
    const openGroupId = route.params?.openGroupId;
    const openGroupName = route.params?.openGroupName;
    if (openGroupId && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      navigation.navigate('Chat', {
        groupId: openGroupId,
        groupName: openGroupName || 'Admin Chat',
      });
    }
  }, [route.params?.openGroupId, route.params?.openGroupName]);

  useFocusEffect(
    useCallback(() => {
      hasAutoNavigated.current = false;
      setOnlinePeerUids(new Set());
      peerUidByGuid.current = {};
      fetchConversations();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});

      const presenceListenerID = 'messages-list-presence';
      cometChatService.addUserPresenceListener(
        presenceListenerID,
        (u: any) => {
          const uid: string = u.getUid?.() ?? '';
          if (uid) setOnlinePeerUids(prev => new Set([...prev, uid]));
        },
        (u: any) => {
          const uid: string = u.getUid?.() ?? '';
          if (uid) setOnlinePeerUids(prev => { const next = new Set(prev); next.delete(uid); return next; });
        }
      );

      return () => {
        cometChatService.removeUserPresenceListener(presenceListenerID);
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('Chat', {
      groupId: conversation.conversationWith.guid,
      groupName: conversation.conversationWith.name,
    });
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderAvatar = (conversation: Conversation) => {
    const guid = conversation.conversationWith.guid;
    const isAdminDm = guid.startsWith('adm_');
    const isContactGroup = guid.startsWith('contact_');
    const isPeerDm = guid.startsWith('peer_');
    const imageUrl = bubbleImages[guid] || conversation.conversationWith.icon;
    const dmData = dmAvatarData[guid];

    if (isPeerDm) {
      const memberPhoto = dmData?.memberPhoto || imageUrl;
      const peerUid = peerUidByGuid.current[guid];
      const isOnline = !!peerUid && onlinePeerUids.has(peerUid);
      return (
        <View style={styles.dmAvatarContainer}>
          {memberPhoto ? (
            <Image source={{ uri: memberPhoto }} style={styles.dmMemberPhoto} />
          ) : (
            <View style={[styles.dmMemberPhoto, styles.dmMemberPhotoPlaceholder]}>
              <Text style={styles.avatarText}>
                {conversation.conversationWith.name.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {isOnline && (
            <View style={styles.onlineStatusDot} testID={`status-online-${guid}`} />
          )}
        </View>
      );
    }

    if (isAdminDm || isContactGroup) {
      const memberPhoto = dmData?.memberPhoto || imageUrl;
      const bubbleCover = dmData?.bubbleCover;
      const peerUid = peerUidByGuid.current[guid];
      const isOnline = !!peerUid && onlinePeerUids.has(peerUid);
      return (
        <View style={styles.dmAvatarContainer}>
          {memberPhoto ? (
            <Image source={{ uri: memberPhoto }} style={styles.dmMemberPhoto} />
          ) : (
            <View style={[styles.dmMemberPhoto, styles.dmMemberPhotoPlaceholder]}>
              <Text style={styles.avatarText}>
                {conversation.conversationWith.name.split(':').pop()?.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {isOnline ? (
            <View style={styles.onlineStatusDot} testID={`status-online-${guid}`} />
          ) : bubbleCover ? (
            <Image source={{ uri: bubbleCover }} style={styles.dmBubbleBadge} />
          ) : (
            <View style={[styles.dmBubbleBadge, styles.dmBubbleBadgePlaceholder]}>
              <Text style={styles.dmBubbleBadgeText}>
                {conversation.conversationWith.name.split(':')[0]?.trim().charAt(0).toUpperCase() || 'B'}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (imageUrl) {
      return (
        <View style={styles.bubbleAvatarRing}>
          <Image source={{ uri: imageUrl }} style={styles.bubbleAvatarImage} />
        </View>
      );
    }

    return (
      <View style={styles.bubbleAvatarRing}>
        <View style={styles.bubbleAvatarPlaceholder}>
          <Text style={styles.avatarText}>
            {conversation.conversationWith.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  const bellIcon = (
    <TouchableOpacity style={styles.bellButton} onPress={() => (navigation as any).navigate('Explore', { screen: 'Notifications' })}>
      <View>
        <Ionicons name="notifications-outline" size={24} color={Colors.text.primary} />
        {unreadNotifCount > 0 && (
          <View style={NotificationBadge.badge}>
            <Text style={NotificationBadge.badgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const FILTER_OPTIONS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'bubbles', label: 'Bubbles' },
    { key: 'dms', label: 'DMs' },
  ];

  const hamburgerButton = (
    <TouchableOpacity
      style={styles.hamburgerButton}
      onPress={() => setShowFilterMenu(true)}
      activeOpacity={0.7}
    >
      <Ionicons name="menu-outline" size={24} color={Colors.text.primary} />
    </TouchableOpacity>
  );

  const renderFilterMenu = () => (
    <Modal
      visible={showFilterMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowFilterMenu(false)}
    >
      <TouchableOpacity
        style={styles.filterOverlay}
        activeOpacity={1}
        onPress={() => setShowFilterMenu(false)}
      >
        <View style={styles.filterDropdown}>
          {FILTER_OPTIONS.map((option, index) => (
            <React.Fragment key={option.key}>
              {index > 0 && <View style={styles.filterSeparator} />}
              <TouchableOpacity
                style={styles.filterItem}
                onPress={() => {
                  setActiveFilter(option.key);
                  setShowFilterMenu(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterItemText,
                    activeFilter === option.key && styles.filterItemTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {activeFilter === option.key && (
                  <Ionicons name="checkmark" size={18} color={Colors.brand.bubbleBlue} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const filteredConversations = conversations.filter((conv) => {
    const guid = conv.conversationWith.guid;
    const isPeerDm = guid.startsWith('peer_');
    const isDm = guid.startsWith('contact_') || guid.startsWith('adm_') || isPeerDm;

    if (isDm) {
      // `peer_` threads are direct user-to-user DMs — always show them.
      if (isPeerDm) {
        if (activeFilter === 'bubbles') return false;
        return true;
      }
      // `adm_` threads are only created for approved bubble members. Hide them if the
      // user is no longer a member of the associated bubble (e.g. was kicked/left).
      if (guid.startsWith('adm_')) {
        const m = guid.match(/^adm_(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (m && !approvedBubbleIds.has(m[1])) return false;
      }
      // `contact_` threads can be initiated by non-members contacting admins, so we
      // do NOT gate them on approved membership. However, if we detected the associated
      // bubble was deleted (via a 404 during image fetch), we hide the stale thread.
      // CometChat-level cleanup (removing the user from the group) also handles the
      // post-kick/leave case for most threads.
      if (guid.startsWith('contact_')) {
        const m = guid.match(/^contact_(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (m && deletedContactBubbleIds.has(m[1])) return false;
      }
    } else {
      // Permission check: bubble group chats are only shown when the user
      // is a current approved member of that bubble.
      if (!approvedBubbleIds.has(guid)) return false;
    }

    // Tab filter
    if (activeFilter === 'bubbles') return !isDm;
    if (activeFilter === 'dms') return isDm;
    return true;
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          {hamburgerButton}
          <Text style={styles.headerTitle}>Messages</Text>
          {bellIcon}
        </View>
        {renderFilterMenu()}
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  if (conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          {hamburgerButton}
          <Text style={styles.headerTitle}>Messages</Text>
          {bellIcon}
        </View>
        {renderFilterMenu()}
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={40} color={Colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Join some bubbles to start chatting with your community!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {hamburgerButton}
        <Text style={styles.headerTitle}>Messages</Text>
        {bellIcon}
      </View>
      {renderFilterMenu()}

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.conversationId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreConversations}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              size="small"
              color={Colors.brand.bubbleBlue}
              style={{ paddingVertical: 16 }}
            />
          ) : null
        }
        renderItem={({ item: conversation }) => (
          <AnimatedPressable
            style={styles.conversationItem}
            scaleValue={0.97}
            onPress={() => handleConversationPress(conversation)}
          >
            {renderAvatar(conversation)}

            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {conversation.conversationWith.name}
                </Text>
                {conversation.lastMessage?.sentAt && (
                  <Text style={styles.time}>
                    {formatTime(conversation.lastMessage.sentAt)}
                  </Text>
                )}
              </View>

              <View style={styles.conversationFooter}>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {conversation.lastMessage?.text
                    ? `${conversation.lastMessage.sender?.name || 'Someone'}: ${conversation.lastMessage.text}`
                    : 'No messages yet'}
                </Text>
                {conversation.unreadMessageCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {conversation.unreadMessageCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </AnimatedPressable>
        )}
      />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  filterDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 50,
    left: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    minWidth: 160,
    ...CardShadow,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  filterItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  filterItemTextActive: {
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
  filterSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.lg,
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.base,
  },
  list: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bubbleAvatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: Colors.brand.bubbleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bubbleAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.neutral.coolMist,
  },
  bubbleAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.neutral.coolMist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dmAvatarContainer: {
    width: 56,
    height: 56,
    marginRight: 12,
    position: 'relative' as const,
  },
  dmMemberPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.neutral.coolMist,
  },
  dmMemberPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
  },
  dmBubbleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.brand.skyWhite,
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    backgroundColor: Colors.neutral.coolMist,
  },
  dmBubbleBadgePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.bubbleBlue,
  },
  dmBubbleBadgeText: {
    color: Colors.brand.skyWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  onlineStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: Colors.background.secondary,
    position: 'absolute' as const,
    bottom: 1,
    right: 1,
  },
  avatarText: {
    color: Colors.brand.skyWhite,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semiBold,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  time: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    flex: 1,
    marginRight: Spacing.sm,
  },
  unreadBadge: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.sm + 2,
    minWidth: Spacing.xl,
    height: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs + 2,
  },
  unreadText: {
    color: Colors.brand.skyWhite,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
});
