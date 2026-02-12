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
  Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';
import SuccessModal from '../../components/SuccessModal';
import MultiImagePicker from '../../components/MultiImagePicker';
import { Colors, Spacing, Radius, Typography, SwitchColors } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
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

export default function CreateBubbleScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [privacy, setPrivacy] = useState('Public');
  const [images, setImages] = useState<string[]>([]);
  const [campusOnly, setCampusOnly] = useState(false);
  
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isCampusVerified = user?.campusVerified && user?.campusId;

  const isFormValid = title && tagline && category && description;

  const handleCreate = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const rules = rulesText
        .split('\n')
        .map(rule => rule.trim())
        .filter(rule => rule.length > 0);

      const response = await fetch(`${API_URL}/api/bubbles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          tagline,
          category,
          description,
          rules,
          privacy,
          coverImage: images.length > 0 ? images[0] : null,
          images,
          campusId: campusOnly && isCampusVerified ? user?.campusId : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create bubble');
        return;
      }

      // Create CometChat group for this bubble and join it
      try {
        const groupType = privacy.toLowerCase();
        await cometChatService.createGroup(data.id, title, groupType);
        console.log('CometChat group created for bubble:', data.id);
        
        // Join the group to ensure it shows in conversations
        // Note: Creator may already be added by createGroup, but joinGroup handles this gracefully
        try {
          await cometChatService.joinGroup(data.id, groupType);
          console.log('Joined CometChat group:', data.id);
        } catch (joinError: any) {
          // Already a member is fine - creator is often auto-added
          console.log('Join group note:', joinError?.code || joinError);
        }
        
        // Send a welcome message to make the conversation appear in the list
        try {
          await cometChatService.sendMessage(data.id, `Welcome to ${title}! 🎉`);
        } catch (msgError) {
          console.log('Welcome message not sent:', msgError);
        }
      } catch (chatError) {
        console.log('CometChat group creation error (may already exist):', chatError);
        // Don't fail bubble creation if chat group fails - it might already exist
      }

      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to create bubble. Please try again.');
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
        <Text style={styles.headerTitle}>Create Bubble</Text>
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

          {isCampusVerified && (
            <View style={styles.inputGroup}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <View style={styles.toggleLabelRow}>
                    <Text style={{ fontSize: 16 }}>🎓</Text>
                    <Text style={styles.toggleLabel}>Campus Only</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Only students from your campus can see and join this bubble
                  </Text>
                </View>
                <Switch
                  value={campusOnly}
                  onValueChange={setCampusOnly}
                  trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
                  thumbColor={campusOnly ? Colors.brand.bubbleBlue : SwitchColors.thumbFalse}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos</Text>
            <MultiImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              (!isFormValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.brand.skyWhite} />
            ) : (
              <Text style={styles.createButtonText}>Create Bubble</Text>
            )}
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
            <ScrollView style={styles.modalScroll}>
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
                    category === cat && styles.modalOptionSelected
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
                  privacy === option && styles.modalOptionSelected
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
        title="Bubble Created!"
        subtitle="Your bubble has been created successfully"
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
    lineHeight: 16,
  },
  createButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: Colors.brand.skyWhite,
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
    padding: 20,
    maxHeight: '70%',
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
  modalScroll: {
    maxHeight: 400,
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
});
