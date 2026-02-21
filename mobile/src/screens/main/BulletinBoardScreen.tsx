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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';
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

  const renderFilterTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
      <TouchableOpacity
        style={[styles.filterChip, selectedTypeId === null && styles.filterChipActive]}
        onPress={() => handleFilterChange(null)}
      >
        <Text style={[styles.filterChipText, selectedTypeId === null && styles.filterChipTextActive]}>All</Text>
      </TouchableOpacity>
      {postTypes.map((pt) => (
        <TouchableOpacity
          key={pt.id}
          style={[styles.filterChip, selectedTypeId === pt.id && styles.filterChipActive]}
          onPress={() => handleFilterChange(pt.id)}
        >
          <Text style={[styles.filterChipText, selectedTypeId === pt.id && styles.filterChipTextActive]}>{pt.displayName}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPost = ({ item }: { item: BulletinPost }) => {
    return (
      <TouchableOpacity
        style={[
          styles.postCard,
          { borderLeftColor: item.postType.color, borderLeftWidth: 4 },
        ]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id, bubbleId })}
        activeOpacity={0.7}
      >
        <View style={styles.postTypeRow}>
          <View style={[styles.postTypeBadge, { backgroundColor: item.postType.color + '20' }]}>
            <Text style={[styles.postTypeBadgeText, { color: item.postType.color }]}>{item.postType.displayName}</Text>
          </View>
          {item.isPinned && (
            <Ionicons name="pin" size={16} color={Colors.brand.primary} style={styles.pinIcon} />
          )}
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
      </TouchableOpacity>
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
    maxHeight: 44,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterContent: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  filterChipActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  filterChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
  },
  filterChipTextActive: {
    color: Colors.background.primary,
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
});
