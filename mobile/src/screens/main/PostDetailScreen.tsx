import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'PostDetail'>;
  route: RouteProp<ExploreStackParamList, 'PostDetail'>;
};

type PostType = {
  id: number;
  name: string;
  displayName: string;
  color: string;
};

type Author = {
  id: string;
  name: string;
  profilePhoto?: string | null;
};

type BulletinPost = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  isPinned: boolean;
  createdAt: string;
  authorId: string;
  author: Author;
  postType: PostType;
};

type BulletinReply = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: Author;
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

export default function PostDetailScreen({ navigation, route }: Props) {
  const { postId } = route.params;
  const { token, user } = useAuth();
  const [post, setPost] = useState<BulletinPost | null>(null);
  const [replies, setReplies] = useState<BulletinReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [postRes, repliesRes] = await Promise.all([
        apiService.getBulletinPost(postId),
        apiService.getBulletinReplies(postId),
      ]);
      setPost(postRes);
      setReplies(repliesRes);
    } catch (err) {
      console.error('Failed to load post:', err);
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submitting) return;
    try {
      setSubmitting(true);
      const newReply = await apiService.createBulletinReply(postId, replyText.trim());
      setReplies(prev => [...prev, { ...newReply, authorId: user!.id, author: { id: user!.id, name: user!.name, profilePhoto: user!.profilePhoto } }]);
      setReplyText('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit reply';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderReply = ({ item }: { item: BulletinReply }) => {
    const isOwn = user?.id === item.authorId;
    return (
      <View style={[styles.replyCard, isOwn && styles.ownReplyCard]}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyAuthor}>{isOwn ? 'You' : item.author.name}</Text>
          <Text style={styles.replyTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.replyBody}>{item.body}</Text>
      </View>
    );
  };

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isOwnPost = user?.id === post.authorId;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Post</Text>
          <View style={{ width: 32 }} />
        </View>

        <FlatList
          data={replies}
          renderItem={renderReply}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={[
              styles.postContainer,
              { borderLeftColor: post.postType.color, borderLeftWidth: 4 },
            ]}>
              <View style={styles.postTypeRow}>
                <View style={[styles.postTypeBadge, { backgroundColor: post.postType.color + '20' }]}>
                  <Text style={[styles.postTypeBadgeText, { color: post.postType.color }]}>{post.postType.displayName}</Text>
                </View>
                {post.isPinned && (
                  <Ionicons name="pin" size={16} color={Colors.brand.primary} />
                )}
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postBody}>{post.body}</Text>
              {post.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
              )}
              <View style={styles.postMeta}>
                <Text style={styles.postAuthor}>{isOwnPost ? 'You' : post.author.name}</Text>
                <Text style={styles.postDot}> · </Text>
                <Text style={styles.postTime}>{formatTimeAgo(post.createdAt)}</Text>
              </View>
              {replies.length > 0 && (
                <View style={styles.repliesHeader}>
                  <Text style={styles.repliesCount}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</Text>
                </View>
              )}
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.text.tertiary}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSubmitReply}
            disabled={!replyText.trim() || submitting}
            style={[styles.sendButton, (!replyText.trim() || submitting) && styles.sendButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.background.primary} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.background.primary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  postContainer: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  ownPostContainer: {},
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
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  postBody: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  postAuthor: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.medium,
  },
  postDot: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  postTime: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  repliesHeader: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: Spacing.md,
  },
  repliesCount: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  replyCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    width: '75%',
    alignSelf: 'flex-start',
  },
  ownReplyCard: {
    alignSelf: 'flex-end',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  replyAuthor: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
