import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, BulletinPillStyles } from '../../styles/theme';
import MultiImagePicker from '../../components/MultiImagePicker';
import BubbleButton from '../../components/BubbleButton';
import { BulletinPostIcon, BulletinCancelIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'CreatePost'>;
  route: RouteProp<ExploreStackParamList, 'CreatePost'>;
};

type PostType = {
  id: number;
  name: string;
  displayName: string;
  color: string;
  adminOnly: boolean;
};

export default function CreatePostScreen({ navigation, route }: Props) {
  const { bubbleId, preselectedTypeId } = route.params;
  const { token, user } = useAuth();
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [typesRes, membershipsRes] = await Promise.all([
          apiService.getBulletinPostTypes(),
          apiService.getBubbleMembers(bubbleId),
        ]);
        setPostTypes(typesRes);

        const myMembership = (membershipsRes as any[]).find?.((m: any) => m.userId === user?.id);
        setUserRole(myMembership?.role || null);

        const isAdminUser = myMembership?.role === 'admin' || user?.isSuperAdmin;

        if (preselectedTypeId) {
          const preselected = typesRes.find((pt: PostType) => pt.id === preselectedTypeId);
          if (preselected && (!preselected.adminOnly || isAdminUser)) {
            setSelectedTypeId(preselectedTypeId);
          } else {
            const firstAvailable = typesRes.find((pt: PostType) => {
              if (pt.adminOnly && !isAdminUser) return false;
              return true;
            });
            if (firstAvailable) setSelectedTypeId(firstAvailable.id);
          }
        } else {
          const firstAvailable = typesRes.find((pt: PostType) => {
            if (pt.adminOnly && !isAdminUser) return false;
            return true;
          });
          if (firstAvailable) setSelectedTypeId(firstAvailable.id);
        }
      } catch (err) {
        console.error('Failed to load post types:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [bubbleId, token, user]);

  const isAdmin = userRole === 'admin' || user?.isSuperAdmin;

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || !selectedTypeId || submitting) return;

    try {
      setSubmitting(true);
      await apiService.createBulletinPost(bubbleId, {
        postTypeId: selectedTypeId,
        title: title.trim(),
        body: body.trim(),
        imageUrl: images[0] || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim() && body.trim() && selectedTypeId && !submitting;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} testID="button-cancel-post">
            <BulletinCancelIcon width={100} height={33} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            testID="button-post"
            style={{ opacity: canSubmit && !submitting ? 1 : 0.4 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.brand.primary} />
            ) : (
              <BulletinPostIcon width={100} height={33} opacity={canSubmit ? 1 : 0.4} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Category</Text>
          <View style={[BulletinPillStyles.container, styles.typesContainer, { justifyContent: 'center' }]}>
            {postTypes.map((pt) => {
              const disabled = pt.adminOnly && !isAdmin;
              return (
                <TouchableOpacity
                  key={pt.id}
                  style={[
                    BulletinPillStyles.chip,
                    selectedTypeId === pt.id && [BulletinPillStyles.chipActive, { backgroundColor: pt.color }],
                    disabled && BulletinPillStyles.chipDisabled,
                  ]}
                  onPress={() => !disabled && setSelectedTypeId(pt.id)}
                  disabled={disabled}
                >
                  <Text style={[
                    BulletinPillStyles.chipText,
                    selectedTypeId === pt.id && BulletinPillStyles.chipTextActive,
                    disabled && BulletinPillStyles.chipTextDisabled,
                  ]}>
                    {pt.displayName}
                  </Text>
                  {disabled && <Text style={styles.adminOnlyBadge}>Admin</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Give your post a title"
            placeholderTextColor={Colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>Body</Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="Write your post..."
            placeholderTextColor={Colors.text.tertiary}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <Text style={styles.label}>Photo (optional)</Text>
          <MultiImagePicker
            images={images}
            onImagesChange={setImages}
            maxImages={1}
            addLabel="Add a photo"
          />

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
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
  },
  postButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  postButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  typesContainer: {
    marginBottom: Spacing.xl,
  },
  adminOnlyBadge: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    marginLeft: 2,
  },
  titleInput: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  bodyInput: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 150,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: Spacing.xl,
  },
});
