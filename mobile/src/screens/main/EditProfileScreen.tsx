import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;
};

const INTERESTS = [
  { id: 'running', label: 'Running' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'coffee', label: 'Coffee Meets' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'biking', label: 'Biking' },
  { id: 'pets', label: 'Pets' },
  { id: 'photography', label: 'Photography' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'music', label: 'Music' },
  { id: 'art', label: 'Art' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'reading', label: 'Reading' },
  { id: 'fitness', label: 'Fitness' },
];

type BubbleItem = {
  id: string;
  title: string;
  category?: string;
  coverImage?: string | null;
};

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

export default function EditProfileScreen({ navigation }: Props) {
  const { user, token, refreshUser } = useAuth();
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [myBubbles, setMyBubbles] = useState<BubbleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        apiService.setToken(token);
        apiService.getMyBubbles().then((bubbles: any) => {
          setMyBubbles(bubbles || []);
        }).catch(() => {});
      }
    }, [token])
  );

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
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
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="button-back-edit-profile"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <View style={styles.separator} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
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
            </View>
            <Text style={styles.addLabel}>Add</Text>
            <Text style={styles.avatarName}>{user.name}</Text>
          </View>

          <View style={[styles.sectionCard, CARD_SHADOW]}>
            <Text style={styles.sectionTitle}>My Profile</Text>
            <Text style={styles.sectionDescription}>
              Admins and members can see your profile and it may appear across Bubble to help us build trust in our community.
            </Text>
          </View>

          <View style={[styles.sectionCard, CARD_SHADOW]}>
            <Text style={styles.sectionTitle}>About Me</Text>
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

          <View style={[styles.sectionCard, CARD_SHADOW]}>
            <Text style={styles.sectionTitle}>My Interests</Text>
            <View style={styles.interestsGrid}>
              {INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest.label);
                return (
                  <TouchableOpacity
                    key={interest.id}
                    style={[
                      styles.interestChip,
                      isSelected && styles.interestChipSelected,
                    ]}
                    onPress={() => toggleInterest(interest.label)}
                    testID={`chip-interest-${interest.id}`}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        isSelected && styles.interestChipTextSelected,
                      ]}
                    >
                      {interest.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.sectionCard, CARD_SHADOW]}>
            <Text style={styles.sectionTitle}>My Bubbles</Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.background.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
  },
  headerPlaceholder: {
    width: 40,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
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
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
    marginBottom: 8,
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
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  interestChipSelected: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    borderColor: Colors.brand.bubbleBlue,
  },
  interestChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
  },
  interestChipTextSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold as any,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
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
