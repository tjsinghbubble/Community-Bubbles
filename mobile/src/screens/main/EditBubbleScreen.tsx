import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import MultiImagePicker from '../../components/MultiImagePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, SwitchColors, Gradients } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const CATEGORIES = [
  'Sports & Fitness',
  'Arts & Culture',
  'Food & Drink',
  'Technology',
  'Music',
  'Outdoors',
  'Gaming',
  'Books & Writing',
  'Photography',
  'Business',
  'Wellness',
  'Social',
  'Other',
];

const PRIVACY_OPTIONS = ['Public', 'Private'];

export default function EditBubbleScreen({ navigation, route }: Props) {
  const { bubble } = route.params as { bubble: any };
  
  const [title, setTitle] = useState(bubble.title || '');
  const [tagline, setTagline] = useState(bubble.tagline || '');
  const [category, setCategory] = useState(bubble.category || '');
  const [description, setDescription] = useState(bubble.description || '');
  const [rulesText, setRulesText] = useState(
    Array.isArray(bubble.rules) ? bubble.rules.join('\n') : ''
  );
  const [privacy, setPrivacy] = useState(bubble.privacy || 'Public');
  const [images, setImages] = useState<string[]>(
    Array.isArray(bubble.images) ? bubble.images : (bubble.coverImage ? [bubble.coverImage] : [])
  );
  
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isFormValid = title && tagline && category && description;

  const handleSave = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const rules = rulesText
        .split('\n')
        .map(rule => rule.trim())
        .filter(rule => rule.length > 0);

      await apiService.updateBubble(bubble.id, {
        title,
        tagline,
        category,
        description,
        rules,
        privacy,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        campusId: bubble.campusId,
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update bubble. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Bubble</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bubble Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Give your bubble a name"
              placeholderTextColor={Colors.neutral.coolMist}
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tagline *</Text>
            <TextInput
              style={styles.input}
              placeholder="A short description"
              placeholderTextColor={Colors.neutral.coolMist}
              value={tagline}
              onChangeText={setTagline}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Text style={category ? styles.selectText : styles.selectPlaceholder}>
                {category || 'Select a category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people what this bubble is about..."
              placeholderTextColor={Colors.neutral.coolMist}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Community Rules</Text>
            <Text style={styles.helperText}>
              Enter each rule on a new line
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="1. Be respectful&#10;2. No spam&#10;3. Stay on topic"
              placeholderTextColor={Colors.neutral.coolMist}
              value={rulesText}
              onChangeText={setRulesText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Privacy</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowPrivacyPicker(true)}
            >
              <Text style={styles.selectText}>{privacy}</Text>
              <Ionicons name="chevron-down" size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {privacy === 'Public' 
                ? 'Anyone can find and join this bubble'
                : 'Only invited members can join'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos</Text>
            <MultiImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
            />
          </View>

          <TouchableOpacity
            style={[(!isFormValid || loading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid || loading}
          >
            <LinearGradient
              colors={Gradients.button.colors as unknown as string[]}
              start={Gradients.button.start}
              end={Gradients.button.end}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator color={Colors.neutral.charcoal} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.neutral.charcoal} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.modalOption}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    category === cat && styles.modalOptionSelected,
                  ]}>
                    {cat}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPrivacyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacyPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPrivacyPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Privacy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.neutral.charcoal} />
              </TouchableOpacity>
            </View>
            {PRIVACY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setPrivacy(option);
                  setShowPrivacyPicker(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  privacy === option && styles.modalOptionSelected,
                ]}>
                  {option}
                </Text>
                {privacy === option && (
                  <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title="Bubble Updated!"
        subtitle="Your changes have been saved successfully"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.neutral.cloudGrey,
    color: Colors.neutral.charcoal,
  },
  textArea: {
    minHeight: 100,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.neutral.cloudGrey,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
  },
  helperText: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 4,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.neutral.charcoal,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  modalOptionSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
});
