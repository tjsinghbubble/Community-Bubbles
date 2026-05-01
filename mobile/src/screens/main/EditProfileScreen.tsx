import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { requestPhotoLibraryAccess } from '../../utils/permissions';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SECTION_CARD_PADDING = 20;
const SCROLL_CONTENT_PADDING = Spacing.lg;
const CARD_GAP = 8;
const INTEREST_CARD_SIZE = Math.floor(
  (SCREEN_WIDTH - SCROLL_CONTENT_PADDING * 2 - SECTION_CARD_PADDING * 2 - CARD_GAP * 2) / 3
);
const ALL_TAB_ID = -1;

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;
  route: RouteProp<ProfileStackParamList, 'EditProfile'>;
};

interface CategoryItem {
  id: number;
  name: string;
  displayName: string;
  image: string | null;
  parentId: number | null;
}

type BubbleItem = {
  id: string;
  title: string;
  category?: string;
  coverImage?: string | null;
};


export default function EditProfileScreen({ navigation, route }: Props) {
  const focusField = route?.params?.focusField;
  const { user, token, refreshUser } = useAuth();
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [parentCategories, setParentCategories] = useState<CategoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<number>(ALL_TAB_ID);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [myBubbles, setMyBubbles] = useState<BubbleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingAbout, setEditingAbout] = useState(focusField === 'bio');
  const [editingInterests, setEditingInterests] = useState(focusField === 'interests');

  const scrollViewRef = useRef<ScrollView>(null);
  const photoSectionY = useRef(0);
  const bioSectionY = useRef(0);
  const interestsSectionY = useRef(0);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(false);
    try {
      const res = await fetch(`${API_URL}/api/categories/flat`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data: CategoryItem[] = await res.json();
      setParentCategories(data.filter(c => c.parentId === null));
      setCategories(data.filter(c => c.parentId !== null));
    } catch (err: any) {
      logAppWarn('EditProfile:categoriesLoadFailed', { error: err?.message ?? 'unknown' });
      setCategoriesError(true);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handlePickPhoto = async () => {
    const granted = await requestPhotoLibraryAccess();
    if (!granted) {
      logAppWarn('EditProfile:photoLibraryPermissionDenied', { platform: Platform.OS });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const photoUri = result.assets[0].uri;
        const photoResponse = await fetch(photoUri);
        const blob = await photoResponse.blob();
        const ext = photoUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        apiService.setToken(token);
        const uploadRes = await fetch(`${API_URL}/api/uploads/request-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ name: `profile.${ext}`, contentType: mimeType }),
        });

        if (!uploadRes.ok) {
          logAppWarn('EditProfile:photoUploadFailed', { error: `presigned-url-request-failed: ${uploadRes.status}` });
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
          return;
        }

        const uploadData = await uploadRes.json();

        if (!uploadData.uploadURL) {
          logAppWarn('EditProfile:photoUploadFailed', { error: 'missing-upload-url' });
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
          return;
        }

        const putRes = await fetch(uploadData.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: blob,
        });

        if (!putRes.ok) {
          logAppWarn('EditProfile:photoUploadFailed', { error: `upload-put-failed:${putRes.status}` });
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
          return;
        }

        const photoUrl = uploadData.objectPath.startsWith('http')
          ? uploadData.objectPath
          : `${API_URL}${uploadData.objectPath}`;
        await apiService.updateProfile({ profilePhoto: photoUrl });
        if (refreshUser) await refreshUser();
        logAppEvent('EditProfile:photoUploadSuccess', {
          mimeType,
          ...(result.assets[0].fileSize != null ? { fileSize: result.assets[0].fileSize } : {}),
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'unknown';
        logAppWarn('EditProfile:photoUploadFailed', { error: errMsg });
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (!focusField) return;
    const timer = setTimeout(() => {
      if (focusField === 'photo') {
        handlePickPhoto();
      } else if (focusField === 'bio') {
        scrollViewRef.current?.scrollTo({ y: bioSectionY.current, animated: true });
      } else if (focusField === 'interests') {
        scrollViewRef.current?.scrollTo({ y: interestsSectionY.current, animated: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [focusField]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        apiService.setToken(token);
        apiService.getMyBubbles().then((bubbles: any) => {
          const list = bubbles || [];
          setMyBubbles(list);
          logAppEvent('EditProfile:bubblesLoaded', { bubblesCount: list.length });
        }).catch((err: any) => {
          logAppWarn('EditProfile:bubblesLoadFailed', { error: err?.message ?? 'unknown' });
        });
      }
    }, [token])
  );

  const toggleInterest = (name: string) => {
    setSelectedInterests(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const handleDone = async () => {
    if (saving) return;
    setSaving(true);
    try {
      apiService.setToken(token);
      await apiService.updateProfile({
        aboutMe: aboutMe.trim() || undefined,
        interests: selectedInterests,
      });
      if (refreshUser) await refreshUser();
      logAppEvent('EditProfile:saveSuccess', {
        fieldCount: (aboutMe.trim() ? 1 : 0) + selectedInterests.length,
        interestCount: selectedInterests.length,
        hasAboutMe: !!aboutMe.trim(),
      });
      navigation.goBack();
    } catch (err: any) {
      logAppWarn('EditProfile:saveFailed', { error: err?.message ?? 'unknown' });
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Edit Profile" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={styles.avatarSection}
            onLayout={(e) => { photoSectionY.current = e.nativeEvent.layout.y; }}
          >
            <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickPhoto} activeOpacity={0.7} testID="button-edit-photo">
              {user.profilePhoto ? (
                <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cameraIconOverlay}>
                <Ionicons name="camera" size={16} color={Colors.background.primary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.addLabel}>{user.profilePhoto ? 'Edit' : 'Add'}</Text>
            <Text style={styles.avatarName}>{user.name}</Text>
          </View>

          <View style={[styles.sectionCard, CardShadow]}>
            <Text style={styles.sectionTitle}>My Profile</Text>
            <Text style={styles.sectionDescription}>
              Admins and members can see your profile and it may appear across Bubble to help us build trust in our community.
            </Text>
          </View>

          <View
            style={[styles.sectionCard, CardShadow]}
            onLayout={(e) => { bioSectionY.current = e.nativeEvent.layout.y; }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>About Me</Text>
              <TouchableOpacity onPress={() => setEditingAbout(!editingAbout)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="button-toggle-about">
                <Ionicons name={editingAbout ? 'checkmark' : 'create-outline'} size={20} color={Colors.brand.bubbleBlue} />
              </TouchableOpacity>
            </View>
            {editingAbout ? (
              <TextInput
                style={styles.aboutInput}
                placeholder="Write something fun and punchy."
                placeholderTextColor={Colors.neutral.coolMist}
                value={aboutMe}
                onChangeText={setAboutMe}
                multiline
                textAlignVertical="top"
                maxLength={300}
                autoFocus
                testID="input-about-me"
              />
            ) : (
              <>
                {aboutMe ? (
                  <TouchableOpacity onPress={() => setEditingAbout(true)}>
                    <Text style={styles.aboutText}>{aboutMe}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.aboutPlaceholder}>Write something fun and punchy.</Text>
                )}
                <TouchableOpacity
                  style={styles.addIntroBtn}
                  onPress={() => setEditingAbout(true)}
                  testID="button-add-intro"
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.brand.bubbleBlue} />
                  <Text style={styles.addIntroBtnText}>{aboutMe ? 'Edit Intro' : 'Add Intro'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View
            style={[styles.sectionCard, CardShadow]}
            onLayout={(e) => { interestsSectionY.current = e.nativeEvent.layout.y; }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Interests</Text>
              <TouchableOpacity onPress={() => setEditingInterests(!editingInterests)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="button-toggle-interests">
                <Ionicons name={editingInterests ? 'checkmark' : 'create-outline'} size={20} color={Colors.brand.bubbleBlue} />
              </TouchableOpacity>
            </View>
            {editingInterests ? (
              categoriesLoading ? (
                <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} style={{ marginVertical: 8 }} />
              ) : categoriesError ? (
                <View style={styles.categoriesErrorContainer}>
                  <Text style={styles.categoriesErrorText}>Couldn't load interests. Please try again.</Text>
                  <TouchableOpacity onPress={loadCategories} style={styles.categoriesRetryBtn} testID="button-retry-categories">
                    <Text style={styles.categoriesRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    style={styles.tabStrip}
                    contentContainerStyle={styles.tabStripContent}
                    testID="scroll-interest-category-tabs"
                  >
                    <TouchableOpacity
                      style={[styles.tab, activeTab === ALL_TAB_ID && styles.tabActive]}
                      onPress={() => setActiveTab(ALL_TAB_ID)}
                      testID="tab-interest-all"
                    >
                      <View style={styles.tabContent}>
                        <Text style={[styles.tabText, activeTab === ALL_TAB_ID && styles.tabTextActive]}>All</Text>
                        {selectedInterests.length > 0 && (
                          <View style={[styles.tabBadge, activeTab === ALL_TAB_ID && styles.tabBadgeActive]}>
                            <Text style={styles.tabBadgeText}>{selectedInterests.length}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {parentCategories.map(parent => {
                      const count = categories.filter(c => c.parentId === parent.id && selectedInterests.includes(c.name)).length;
                      return (
                        <TouchableOpacity
                          key={parent.id}
                          style={[styles.tab, activeTab === parent.id && styles.tabActive]}
                          onPress={() => setActiveTab(parent.id)}
                          testID={`tab-interest-category-${parent.id}`}
                        >
                          <View style={styles.tabContent}>
                            <Text style={[styles.tabText, activeTab === parent.id && styles.tabTextActive]}>
                              {parent.displayName}
                            </Text>
                            {count > 0 && (
                              <View style={[styles.tabBadge, activeTab === parent.id && styles.tabBadgeActive]}>
                                <Text style={styles.tabBadgeText}>{count}</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.interestCardGrid}>
                    {(activeTab === ALL_TAB_ID ? categories : categories.filter(c => c.parentId === activeTab)).map((category) => {
                      const isSelected = selectedInterests.includes(category.name);
                      const imageSource = resolveMediaUrl(category.image);
                      return (
                        <View key={category.name} style={styles.interestCardWrapper}>
                          <TouchableOpacity
                            style={[styles.interestCard, isSelected && styles.interestCardSelected]}
                            onPress={() => toggleInterest(category.name)}
                            activeOpacity={0.8}
                            testID={`button-interest-${category.name}`}
                          >
                            <View style={styles.interestCardInner}>
                              {imageSource ? (
                                <ExpoImage
                                  source={{ uri: imageSource }}
                                  style={styles.interestCardImage}
                                  contentFit="cover"
                                />
                              ) : (
                                <View style={[styles.interestCardImage, styles.interestCardImagePlaceholder]} />
                              )}
                              {isSelected && (
                                <View style={styles.interestCardOverlay}>
                                  <View style={styles.interestCheckCircle}>
                                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          <Text
                            style={[styles.interestCardLabel, isSelected && styles.interestCardLabelSelected]}
                            numberOfLines={2}
                            testID={`text-interest-${category.name}`}
                          >
                            {category.displayName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )
            ) : (
              <View style={styles.interestCardGrid}>
                {selectedInterests.length > 0 ? (
                  selectedInterests.map((interestName) => {
                    const cat = categories.find(c => c.name === interestName);
                    const imageSource = resolveMediaUrl(cat?.image);
                    return (
                      <View key={interestName} style={styles.interestCardWrapper}>
                        <View style={[styles.interestCard, styles.interestCardSelected]}>
                          <View style={styles.interestCardInner}>
                            {imageSource ? (
                              <ExpoImage
                                source={{ uri: imageSource }}
                                style={styles.interestCardImage}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={[styles.interestCardImage, styles.interestCardImagePlaceholder]} />
                            )}
                          </View>
                        </View>
                        <Text style={[styles.interestCardLabel, styles.interestCardLabelSelected]} numberOfLines={2}>
                          {cat?.displayName ?? interestName}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>Tap the edit icon to select interests.</Text>
                )}
              </View>
            )}
          </View>

          <View style={[styles.sectionCard, CardShadow]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Bubbles</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
            </View>
            {myBubbles.length === 0 ? (
              <Text style={styles.emptyText}>You haven't joined any bubbles yet.</Text>
            ) : (
              myBubbles.map((bubble) => (
                <View key={bubble.id} style={styles.bubbleRow}>
                  {bubble.coverImage ? (
                    <Image source={{ uri: bubble.coverImage }} style={styles.bubbleThumb} />
                  ) : (
                    <View style={[styles.bubbleThumb, styles.bubbleThumbPlaceholder]}>
                      <Ionicons name="people" size={18} color={Colors.brand.bubbleBlue} />
                    </View>
                  )}
                  <View style={styles.bubbleInfo}>
                    <Text style={styles.bubbleName}>{bubble.title}</Text>
                    {bubble.category && (
                      <Text style={styles.bubbleCategory}>{bubble.category}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            onPress={handleDone}
            disabled={saving}
            activeOpacity={0.7}
            style={styles.doneBtn}
            testID="button-done"
          >
            <LinearGradient
              colors={['#35A8F7', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 3.6 }}
              style={styles.doneGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.doneText}>Done</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.brand.bubbleBlue + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: Typography.weights.bold as any,
    color: Colors.brand.bubbleBlue,
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.secondary,
  },
  addLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold as any,
    marginBottom: 8,
  },
  avatarName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
  },
  sectionCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  sectionDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    lineHeight: 20,
  },
  aboutInput: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aboutText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 12,
  },
  aboutPlaceholder: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    lineHeight: 20,
    marginBottom: 12,
  },
  addIntroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  addIntroBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
  },
  tabStrip: { flexGrow: 0, marginHorizontal: -SECTION_CARD_PADDING, marginTop: 4, marginBottom: 4 },
  tabStripContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#EAF5FE',
    borderColor: Colors.brand.bubbleBlue,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: Colors.brand.bubbleBlue,
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeActive: {
    backgroundColor: Colors.brand.bubbleBlue,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  interestCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginTop: 4,
  },
  interestCardWrapper: {
    width: INTEREST_CARD_SIZE,
    alignItems: 'center',
    marginBottom: 2,
  },
  interestCard: {
    width: INTEREST_CARD_SIZE,
    height: INTEREST_CARD_SIZE,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  interestCardSelected: {
    borderColor: Colors.brand.bubbleBlue,
  },
  interestCardInner: {
    flex: 1,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  interestCardImage: { width: '100%', height: '100%' },
  interestCardImagePlaceholder: { backgroundColor: '#E0E0E0' },
  interestCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(53, 168, 247, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4D4D4D',
    textAlign: 'center',
    marginTop: 5,
  },
  interestCardLabelSelected: {
    color: Colors.brand.bubbleBlue,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
  },
  categoriesErrorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  categoriesErrorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },
  categoriesRetryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  categoriesRetryText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: '#FFFFFF',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  bubbleThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
  },
  bubbleThumbPlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInfo: {
    flex: 1,
  },
  bubbleName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  bubbleCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  doneBtn: {
    width: '100%',
    marginTop: 8,
  },
  doneGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#1E1F26',
  },
});
