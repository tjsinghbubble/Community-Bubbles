import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Image,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, Gradients, BulletinPillStyles, BulletinPillColors } from '../../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BulletinBoardSkeleton } from '../../components/SkeletonLoader';

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
};

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
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [kebabPostId, setKebabPostId] = useState<string | null>(null);

  const kebabPost = posts.find(p => p.id === kebabPostId) ?? null;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [typesRes, postsRes] = await Promise.all([
        apiService.getBulletinPostTypes(),
        apiService.getBulletinPosts(bubbleId, selectedTypeId ?? undefined),
      ]);
      setPostTypes(typesRes);
      setPosts(postsRes);
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

  const handleCreatePost = () => {
    navigation.navigate('CreatePost', {
      bubbleId,
      bubbleTitle,
      preselectedTypeId: selectedTypeId ?? undefined,
    });
  };

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

  const handleEditPost = () => {
    if (!kebabPost) return;
    setKebabPostId(null);
    navigation.navigate('CreatePost', {
      bubbleId,
      bubbleTitle,
      editPostId: kebabPost.id,
      editTitle: kebabPost.title,
      editBody: kebabPost.body,
      preselectedTypeId: kebabPost.postTypeId,
    } as any);
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
        <View style={styles.kebabDropdown}>
          <TouchableOpacity style={styles.kebabItem} onPress={handlePinPost}>
            <Ionicons name="pin-outline" size={20} color={Colors.brand.primary} />
            <Text style={[styles.kebabItemText, { color: Colors.brand.primary }]}>
              {kebabPost?.isPinned ? 'Unpin Post' : 'Pin Post'}
            </Text>
          </TouchableOpacity>
          <View style={styles.kebabSeparatorLight} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleEditPost}>
            <Ionicons name="create-outline" size={20} color={Colors.brand.primary} />
            <Text style={[styles.kebabItemText, { color: Colors.brand.primary }]}>Edit Post</Text>
          </TouchableOpacity>
          <View style={styles.kebabSeparatorLight} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleDeletePost}>
            <Ionicons name="trash-outline" size={20} color={Colors.status.error} />
            <Text style={[styles.kebabItemText, { color: Colors.status.error }]}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderFilterTabs = () => (
    <View style={[BulletinPillStyles.container, styles.filterContainer]}>
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
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => { e.stopPropagation(); setKebabPostId(item.id); }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postBody} numberOfLines={3}>{item.body}</Text>
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{item.author.name.split(' ')[0]} {item.author.name.split(' ')[1]?.[0] ? item.author.name.split(' ')[1][0] + '.' : ''}</Text>
          <Text style={styles.postDot}> · </Text>
          <Text style={styles.postTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <View style={styles.postFooter}>
          <View style={styles.postFooterRight}>
            <Ionicons name="chatbubble-outline" size={14} color={Colors.text.tertiary} />
            <Text style={styles.postFooterCount}>{item.replyCount}</Text>
          </View>
          {item.replyCount > 0 && (
            <Text style={styles.viewReplies}>View {item.replyCount === 1 ? '1 reply' : `${item.replyCount} replies`}</Text>
          )}
        </View>
      </AnimatedPressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Nothing here yet. Start the conversation!</Text>
      <TouchableOpacity
        onPress={handleCreatePost}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Gradients.button.colors as [string, string]}
          start={Gradients.button.start}
          end={Gradients.button.end}
          style={styles.createPostButton}
        >
          <Text style={styles.createPostButtonText}>+ Create a post</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulletin Board</Text>
        <TouchableOpacity
          onPress={handleCreatePost}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={styles.newButton}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
      {renderKebabMenu()}
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  newButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  newButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
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
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
  },
  createPostButton: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  createPostButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
  },
  postCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
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
  pinIcon: {
    marginLeft: Spacing.sm,
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
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  postAuthor: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.medium,
  },
  postDot: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  postTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postFooterCount: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  viewReplies: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  kebabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  kebabDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 50,
    right: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
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
});
