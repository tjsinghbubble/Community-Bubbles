import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Image,
  Modal,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, Gradients, BulletinPillStyles, BulletinPillColors, CardShadow } from '../../styles/theme';
import { FlowHeader } from '../../components/ScreenHeader';
import { BulletinBoardSkeleton } from '../../components/SkeletonLoader';
import { ChatBubbleIcon, ReactionFaceIcon, BulletinNewIcon, CreateAPostIcon, NothingHereYetIcon } from '../../components/icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BulletinBoard'>;
  route: RouteProp<ExploreStackParamList, 'BulletinBoard'>;
};

type PostType = {
  id: number;
  name: string;
  displayName: string;
  color: string;
  adminOnly: boolean;
};

type PostAuthor = {
  id: string;
  name: string;
  profilePhoto?: string | null;
};

type BulletinReply = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: PostAuthor;
};

type ReactionSummary = {
  reactions: { emoji: string; count: number }[];
  userEmojis: string[];
};

type BulletinPost = {
  id: string;
  boardId: string;
  postTypeId: number;
  authorId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  isPinned: boolean;
  createdAt: string;
  author: PostAuthor;
  postType: PostType;
  replyCount: number;
  reactionCount: number;
  userReacted: boolean;
  reactionSummary: ReactionSummary;
};

const EMOJI_MAP: Record<string, string> = {
  thumbsup: '👍',
  heart: '❤️',
  laugh: '😂',
  surprised: '😮',
  cry: '😢',
  pray: '🙏',
};

const EMOJI_PICKER_OPTIONS = [
  { key: 'thumbsup', char: '👍' },
  { key: 'heart', char: '❤️' },
  { key: 'laugh', char: '😂' },
  { key: 'surprised', char: '😮' },
  { key: 'cry', char: '😢' },
  { key: 'pray', char: '🙏' },
];

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function BulletinBoardScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle } = route.params;
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [kebabPostId, setKebabPostId] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [postReplies, setPostReplies] = useState<Record<string, BulletinReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [emojiPickerPostId, setEmojiPickerPostId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [emojiPosition, setEmojiPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const kebabRefs = useRef<Record<string, View | null>>({});
  const emojiRefs = useRef<Record<string, View | null>>({});

  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [overlaySelectedTypeId, setOverlaySelectedTypeId] = useState<number | null>(null);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [overlayBody, setOverlayBody] = useState('');
  const [overlaySubmitting, setOverlaySubmitting] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [overlayUserRole, setOverlayUserRole] = useState<string | null>(null);
  const [overlayEditPostId, setOverlayEditPostId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const kebabPost = posts.find(p => p.id === kebabPostId) ?? null;
  const isAdmin = currentUserRole === 'admin' || user?.isSuperAdmin;
  const isKebabPostAuthor = kebabPost?.authorId === user?.id;

  const openKebab = (postId: string) => {
    const ref = kebabRefs.current[postId];
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        setMenuPosition({ x: x + width, y: y + height + 4 });
        setKebabPostId(postId);
      });
    } else {
      setKebabPostId(postId);
    }
  };

  const openEmojiPicker = (postId: string) => {
    const ref = emojiRefs.current[postId];
    if (ref) {
      ref.measureInWindow((x, y, _width, _height) => {
        setEmojiPosition({ x, y: y - 52 });
        setEmojiPickerPostId(postId);
      });
    } else {
      setEmojiPickerPostId(postId);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [typesRes, postsRes, memberships] = await Promise.all([
        apiService.getBulletinPostTypes(),
        apiService.getBulletinPosts(bubbleId, selectedTypeId ?? undefined),
        apiService.getBubbleMembers(bubbleId),
      ]);
      setPostTypes(typesRes);
      setPosts(postsRes);
      const myMembership = (memberships as any[]).find?.((m: any) => m.userId === user?.id);
      setCurrentUserRole(myMembership?.role || null);
    } catch (err) {
      console.error('Failed to load bulletin board:', err);
    } finally {
      setLoading(false);
    }
  }, [bubbleId, token, selectedTypeId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleFilterChange = (typeId: number | null) => {
    setSelectedTypeId(typeId);
  };

  const handleCreatePost = async () => {
    setOverlayEditPostId(null);
    setOverlayTitle('');
    setOverlayBody('');
    setShowCategoryDropdown(false);
    setOverlaySubmitting(false);
    try {
      const memberships = await apiService.getBubbleMembers(bubbleId);
      const myMembership = (memberships as any[]).find?.((m: any) => m.userId === user?.id);
      setOverlayUserRole(myMembership?.role || null);
      const isAdminUser = myMembership?.role === 'admin' || user?.isSuperAdmin;
      if (selectedTypeId) {
        const selected = postTypes.find(pt => pt.id === selectedTypeId);
        if (selected && (!selected.adminOnly || isAdminUser)) {
          setOverlaySelectedTypeId(selectedTypeId);
        } else {
          const first = postTypes.find(pt => !pt.adminOnly || isAdminUser);
          setOverlaySelectedTypeId(first?.id ?? null);
        }
      } else {
        const first = postTypes.find(pt => !pt.adminOnly || isAdminUser);
        setOverlaySelectedTypeId(first?.id ?? null);
      }
    } catch {
      setOverlaySelectedTypeId(postTypes[0]?.id ?? null);
      setOverlayUserRole(null);
    }
    setShowCreateOverlay(true);
  };

  const handleOverlayCancel = () => {
    setShowCreateOverlay(false);
    setOverlayTitle('');
    setOverlayBody('');
    setOverlaySelectedTypeId(null);
    setShowCategoryDropdown(false);
    setOverlayEditPostId(null);
  };

  const handleOverlaySubmit = async () => {
    if (!overlayTitle.trim() || !overlayBody.trim() || !overlaySelectedTypeId || overlaySubmitting) return;
    try {
      setOverlaySubmitting(true);
      if (overlayEditPostId) {
        await apiService.updateBulletinPost(overlayEditPostId, {
          postTypeId: overlaySelectedTypeId,
          title: overlayTitle.trim(),
          body: overlayBody.trim(),
        });
      } else {
        await apiService.createBulletinPost(bubbleId, {
          postTypeId: overlaySelectedTypeId,
          title: overlayTitle.trim(),
          body: overlayBody.trim(),
        });
      }
      setShowCreateOverlay(false);
      setOverlayTitle('');
      setOverlayBody('');
      setOverlaySelectedTypeId(null);
      setOverlayEditPostId(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || (overlayEditPostId ? 'Failed to save post' : 'Failed to create post'));
    } finally {
      setOverlaySubmitting(false);
    }
  };

  const overlayCanSubmit = overlayTitle.trim() && overlayBody.trim() && overlaySelectedTypeId && !overlaySubmitting;
  const overlayIsAdmin = overlayUserRole === 'admin' || user?.isSuperAdmin;

  const handlePinPost = async () => {
    if (!kebabPost) return;
    setKebabPostId(null);
    try {
      await apiService.toggleBulletinPostPin(kebabPost.id);
      setPosts(prev => prev.map(p =>
        p.id === kebabPost.id ? { ...p, isPinned: !p.isPinned } : p
      ));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to pin post');
    }
  };

  const handleEditPost = async () => {
    if (!kebabPost) return;
    const editPost = kebabPost;
    setKebabPostId(null);
    setOverlayEditPostId(editPost.id);
    setOverlayTitle(editPost.title);
    setOverlayBody(editPost.body);
    setOverlaySelectedTypeId(editPost.postTypeId);
    setShowCategoryDropdown(false);
    setOverlaySubmitting(false);
    try {
      const memberships = await apiService.getBubbleMembers(bubbleId);
      const myMembership = (memberships as any[]).find?.((m: any) => m.userId === user?.id);
      setOverlayUserRole(myMembership?.role || null);
    } catch {
      setOverlayUserRole(null);
    }
    setShowCreateOverlay(true);
  };

  const handleDeletePost = () => {
    if (!kebabPost) return;
    setKebabPostId(null);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteBulletinPost(kebabPost.id);
              setPosts(prev => prev.filter(p => p.id !== kebabPost.id));
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const toggleExpandReplies = async (postId: string) => {
    const newSet = new Set(expandedPostIds);
    if (newSet.has(postId)) {
      newSet.delete(postId);
      setExpandedPostIds(newSet);
      return;
    }
    newSet.add(postId);
    setExpandedPostIds(newSet);
    if (!postReplies[postId]) {
      setLoadingReplies(prev => new Set(prev).add(postId));
      try {
        const replies = await apiService.getBulletinReplies(postId);
        setPostReplies(prev => ({ ...prev, [postId]: replies }));
      } catch (err) {
        console.error('Failed to load replies:', err);
      } finally {
        setLoadingReplies(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    }
  };

  const handleToggleReaction = async (postId: string, emoji: string = 'heart') => {
    setEmojiPickerPostId(null);
    try {
      const result = await apiService.toggleBulletinReaction(postId, emoji);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const summary = { ...p.reactionSummary };
        const reactions = [...summary.reactions];
        const userEmojis = [...summary.userEmojis];
        const existingIdx = reactions.findIndex(r => r.emoji === emoji);

        if (result.added) {
          if (existingIdx >= 0) {
            reactions[existingIdx] = { ...reactions[existingIdx], count: reactions[existingIdx].count + 1 };
          } else {
            reactions.push({ emoji, count: 1 });
          }
          if (!userEmojis.includes(emoji)) userEmojis.push(emoji);
        } else {
          if (existingIdx >= 0) {
            const newCount = reactions[existingIdx].count - 1;
            if (newCount <= 0) {
              reactions.splice(existingIdx, 1);
            } else {
              reactions[existingIdx] = { ...reactions[existingIdx], count: newCount };
            }
          }
          const ueIdx = userEmojis.indexOf(emoji);
          if (ueIdx >= 0) userEmojis.splice(ueIdx, 1);
        }

        const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

        return {
          ...p,
          reactionCount: totalReactions,
          userReacted: userEmojis.length > 0,
          reactionSummary: { reactions, userEmojis },
        };
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to react');
    }
  };

  const selectedOverlayType = postTypes.find(pt => pt.id === overlaySelectedTypeId);

  const renderCreateOverlay = () => {
    return (
      <Modal
        visible={showCreateOverlay}
        transparent
        animationType="slide"
        onRequestClose={handleOverlayCancel}
      >
        <View style={overlayStyles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={handleOverlayCancel}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
          <View style={[overlayStyles.sheet, { paddingBottom: Math.max(20, insets.bottom + 20) }]}>
            <View style={overlayStyles.dragHandle} />
            <Text style={overlayStyles.sheetTitle}>{overlayEditPostId ? 'Edit Post' : 'New Post'}</Text>

            <ScrollView
              style={[overlayStyles.scrollContent, { backgroundColor: 'transparent' }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={overlayStyles.card}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                activeOpacity={0.7}
                testID="overlay-category-selector"
              >
                <Text style={[
                  overlayStyles.cardText,
                  selectedOverlayType && { color: Colors.text.primary, fontWeight: Typography.weights.semiBold },
                ]}>
                  {selectedOverlayType ? selectedOverlayType.displayName : 'Select a Category'}
                </Text>
                <Ionicons
                  name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#969696"
                />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={overlayStyles.dropdownList}>
                  {postTypes.map((pt) => {
                    const disabled = pt.adminOnly && !overlayIsAdmin;
                    return (
                      <TouchableOpacity
                        key={pt.id}
                        style={[
                          overlayStyles.dropdownItem,
                          overlaySelectedTypeId === pt.id && { backgroundColor: pt.color + '15' },
                          disabled && { opacity: 0.4 },
                        ]}
                        onPress={() => {
                          if (!disabled) {
                            setOverlaySelectedTypeId(pt.id);
                            setShowCategoryDropdown(false);
                          }
                        }}
                        disabled={disabled}
                      >
                        <View style={[overlayStyles.dropdownDot, { backgroundColor: pt.color }]} />
                        <Text style={[
                          overlayStyles.dropdownItemText,
                          overlaySelectedTypeId === pt.id && { color: pt.color, fontWeight: Typography.weights.bold },
                        ]}>
                          {pt.displayName}
                        </Text>
                        {disabled && <Text style={overlayStyles.adminBadge}>Admin</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={overlayStyles.label}>Title *</Text>
              <View style={overlayStyles.card}>
                <TextInput
                  style={overlayStyles.titleInput}
                  placeholder="What's this about?"
                  placeholderTextColor="#969696"
                  value={overlayTitle}
                  onChangeText={setOverlayTitle}
                  maxLength={100}
                  testID="overlay-title-input"
                />
              </View>

              <Text style={overlayStyles.label}>Message *</Text>
              <View style={[overlayStyles.card, overlayStyles.messageCard]}>
                <TextInput
                  style={overlayStyles.messageInput}
                  placeholder="Share the details..."
                  placeholderTextColor="#969696"
                  value={overlayBody}
                  onChangeText={setOverlayBody}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  testID="overlay-body-input"
                />
              </View>
            </ScrollView>

            <View style={overlayStyles.buttonRow}>
              <TouchableOpacity
                onPress={handleOverlayCancel}
                style={overlayStyles.cancelButton}
                testID="overlay-cancel-button"
              >
                <Text style={overlayStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleOverlaySubmit}
                disabled={!overlayCanSubmit}
                testID="overlay-post-button"
                style={{ flex: 1 }}
                activeOpacity={0.8}
              >
                {overlayCanSubmit ? (
                  <LinearGradient
                    colors={['#35A8F7', '#FFFFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.7, y: 3.6 }}
                    style={overlayStyles.postButton}
                  >
                    {overlaySubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={overlayStyles.postButtonText}>{overlayEditPostId ? 'Save' : 'Post'}</Text>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={overlayStyles.postButtonDisabled}>
                    <Text style={overlayStyles.postButtonDisabledText}>{overlayEditPostId ? 'Save' : 'Post'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: insets.bottom + 60, backgroundColor: '#FAFAFA' }} />
        </View>
      </Modal>
    );
  };

  const renderKebabMenu = () => (
    <Modal
      visible={kebabPostId !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setKebabPostId(null)}
    >
      <TouchableOpacity
        style={styles.kebabOverlay}
        activeOpacity={1}
        onPress={() => setKebabPostId(null)}
      >
        <View style={[styles.kebabDropdown, { top: menuPosition.y, right: Spacing.lg }]}>
          {isAdmin && (
            <>
              <TouchableOpacity style={styles.kebabItem} onPress={handlePinPost}>
                <Ionicons name="pin-outline" size={20} color={Colors.brand.primary} />
                <Text style={[styles.kebabItemText, { color: Colors.brand.primary }]}>
                  {kebabPost?.isPinned ? 'Unpin Post' : 'Pin Post'}
                </Text>
              </TouchableOpacity>
              <View style={styles.kebabSeparatorLight} />
            </>
          )}
          {isKebabPostAuthor && (
            <>
              <TouchableOpacity style={styles.kebabItem} onPress={handleEditPost}>
                <Ionicons name="create-outline" size={20} color={Colors.brand.primary} />
                <Text style={[styles.kebabItemText, { color: Colors.brand.primary }]}>Edit Post</Text>
              </TouchableOpacity>
              <View style={styles.kebabSeparatorLight} />
            </>
          )}
          {(isKebabPostAuthor || isAdmin) && (
            <TouchableOpacity style={styles.kebabItem} onPress={handleDeletePost}>
              <Ionicons name="trash-outline" size={20} color={Colors.status.error} />
              <Text style={[styles.kebabItemText, { color: Colors.status.error }]}>
                {isAdmin && !isKebabPostAuthor ? 'Remove Post' : 'Delete Post'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderEmojiPicker = () => (
    <Modal
      visible={emojiPickerPostId !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setEmojiPickerPostId(null)}
    >
      <TouchableOpacity
        style={styles.kebabOverlay}
        activeOpacity={1}
        onPress={() => setEmojiPickerPostId(null)}
      >
        <View style={[styles.emojiPickerContainer, { top: emojiPosition.y, right: Spacing.lg }]}>
          {EMOJI_PICKER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.emojiPickerItem}
              onPress={() => emojiPickerPostId && handleToggleReaction(emojiPickerPostId, opt.key)}
            >
              <Text style={styles.emojiPickerEmoji}>{opt.char}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderFilterTabs = () => (
    <View style={[BulletinPillStyles.container, styles.filterContainer, { justifyContent: 'center' }]}>
      <TouchableOpacity
        style={[
          BulletinPillStyles.chip,
          selectedTypeId === null && [BulletinPillStyles.chipActive, { backgroundColor: BulletinPillColors.all }],
        ]}
        onPress={() => handleFilterChange(null)}
      >
        <Text style={[BulletinPillStyles.chipText, selectedTypeId === null && BulletinPillStyles.chipTextActive]}>All</Text>
      </TouchableOpacity>
      {postTypes.map((pt) => (
        <TouchableOpacity
          key={pt.id}
          style={[
            BulletinPillStyles.chip,
            selectedTypeId === pt.id && [BulletinPillStyles.chipActive, { backgroundColor: pt.color }],
          ]}
          onPress={() => handleFilterChange(pt.id)}
        >
          <Text style={[BulletinPillStyles.chipText, selectedTypeId === pt.id && BulletinPillStyles.chipTextActive]}>{pt.displayName}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPost = ({ item }: { item: BulletinPost }) => {
    const isExpanded = expandedPostIds.has(item.id);
    const replies = postReplies[item.id] || [];
    const isLoadingReplies = loadingReplies.has(item.id);
    const authorDisplay = `${item.author.name.split(' ')[0]} ${item.author.name.split(' ')[1]?.[0] ? item.author.name.split(' ')[1][0] + '.' : ''}`;

    return (
      <AnimatedPressable
        style={[
          styles.postCard,
          { borderLeftColor: item.postType.color, borderLeftWidth: 4 },
        ]}
        scaleValue={0.97}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id, bubbleId })}
      >
        <View style={styles.postTypeRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View style={[styles.postTypeBadge, { backgroundColor: item.postType.color + '20' }]}>
              <Text style={[styles.postTypeBadgeText, { color: item.postType.color }]}>{item.postType.displayName}</Text>
            </View>
            {item.isPinned && (
              <Ionicons name="pin" size={16} color={Colors.brand.primary} />
            )}
          </View>
          {(item.authorId === user?.id || isAdmin) && (
            <View ref={(r) => { kebabRefs.current[item.id] = r; }} collapsable={false}>
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => { e.stopPropagation(); openKebab(item.id); }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postBody} numberOfLines={3}>{item.body}</Text>
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}

        <View style={styles.postFooter}>
          <View style={styles.postFooterLeft}>
            <Text style={styles.postAuthor}>{authorDisplay}</Text>
            <Text style={styles.postTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <View style={styles.postFooterRight}>
            <View style={styles.footerIconGroup}>
              <ChatBubbleIcon size={18} color={Colors.text.secondary} />
              {item.replyCount > 0 && (
                <Text style={styles.footerIconCount}>{item.replyCount}</Text>
              )}
            </View>
            {item.reactionSummary?.reactions?.length > 0 ? (
              item.reactionSummary.reactions.map((r) => (
                <TouchableOpacity
                  key={r.emoji}
                  style={styles.footerIconGroup}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => { e.stopPropagation(); handleToggleReaction(item.id, r.emoji); }}
                >
                  <Text style={{ fontSize: 16 }}>{EMOJI_MAP[r.emoji] || r.emoji}</Text>
                  <Text style={styles.footerIconCount}>{r.count}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View ref={(r) => { emojiRefs.current[item.id] = r; }} collapsable={false}>
                <TouchableOpacity
                  style={styles.footerIconGroup}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onLongPress={(e) => { e.stopPropagation(); openEmojiPicker(item.id); }}
                  onPress={(e) => { e.stopPropagation(); openEmojiPicker(item.id); }}
                >
                  <ReactionFaceIcon size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {item.replyCount > 0 && (
          <>
            <TouchableOpacity
              style={styles.caretRow}
              onPress={(e) => { e.stopPropagation(); toggleExpandReplies(item.id); }}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.text.tertiary}
              />
              <Text style={styles.caretText}>
                View {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.repliesContainer}>
                {isLoadingReplies ? (
                  <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginVertical: Spacing.sm }} />
                ) : (
                  replies.map((reply) => (
                    <View key={reply.id} style={styles.replyItem}>
                      <View style={styles.replyHeader}>
                        <Text style={styles.replyAuthor}>
                          {reply.author.name.split(' ')[0]} {reply.author.name.split(' ')[1]?.[0] ? reply.author.name.split(' ')[1][0] + '.' : ''}
                        </Text>
                        <Text style={styles.replyTime}>{formatTimeAgo(reply.createdAt)}</Text>
                      </View>
                      <Text style={styles.replyBody}>{reply.body}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </AnimatedPressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <NothingHereYetIcon />
      <View style={{ marginTop: Spacing.md }}>
        <TouchableOpacity onPress={handleCreatePost} testID="button-create-post-empty" activeOpacity={0.8}>
          <CreateAPostIcon />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="Bulletin Board"
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={handleCreatePost} testID="button-new-post-header">
            <BulletinNewIcon />
          </TouchableOpacity>
        }
      />

      {renderFilterTabs()}

      {loading ? (
        <BulletinBoardSkeleton />
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={posts.length === 0 ? styles.emptyListContent : styles.listContent}
          ListEmptyComponent={renderEmpty}
        />
      )}
      {renderCreateOverlay()}
      {renderKebabMenu()}
      {renderEmojiPicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  newButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: 10,
    marginBottom: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...CardShadow,
  },
  postTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  postTypeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  postTypeBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  postTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  postBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  postImage: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  postAuthor: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    fontWeight: Typography.weights.semiBold,
  },
  postTime: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  postFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  footerIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerIconCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontWeight: Typography.weights.medium,
  },
  caretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  caretText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  repliesContainer: {
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: Spacing.sm,
  },
  replyItem: {
    marginBottom: Spacing.md,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  replyAuthor: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  replyTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  replyBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  kebabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  kebabDropdown: {
    position: 'absolute',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    minWidth: 200,
    ...CardShadow,
  },
  kebabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  kebabItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  kebabSeparatorLight: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.lg,
  },
  emojiPickerContainer: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    borderRadius: 28,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...CardShadow,
    gap: 4,
  },
  emojiPickerItem: {
    padding: Spacing.sm,
    borderRadius: 20,
  },
  emojiPickerEmoji: {
    fontSize: 28,
  },
});

const overlayStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  sheetTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dragHandle: {
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#969696',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 57,
    marginBottom: 16,
  },
  messageCard: {
    minHeight: 101,
    alignItems: 'flex-start',
  },
  cardText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.regular,
    color: '#969696',
    flex: 1,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    padding: 0,
  },
  messageInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    padding: 0,
    minHeight: 70,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: '#FF3B30',
  },
  postButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: '#1E1F26',
  },
  postButtonDisabled: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#969696',
  },
  postButtonDisabledText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    marginTop: -12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  dropdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dropdownItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    flex: 1,
  },
  adminBadge: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
});
