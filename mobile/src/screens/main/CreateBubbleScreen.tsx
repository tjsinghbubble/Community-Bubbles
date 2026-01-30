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
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

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
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [privacy, setPrivacy] = useState('Public');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [loading, setLoading] = useState(false);

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
          coverImage: coverImageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create bubble');
        return;
      }

      Alert.alert('Success', 'Your bubble has been created!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
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
          <Ionicons name="close" size={24} color="#000" />
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
              placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people what this bubble is about..."
              placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {privacy === 'Public' 
                ? 'Anyone can find and join this bubble'
                : 'Only invited members can join'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cover Image URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor="#999"
              value={coverImageUrl}
              onChangeText={setCoverImageUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.helperText}>
              Optional: Add a cover image for your bubble
            </Text>
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
              <ActivityIndicator color="#fff" />
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
                <Ionicons name="close" size={24} color="#000" />
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
                    <Ionicons name="checkmark" size={20} color="hsl(210, 95%, 55%)" />
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
                <Ionicons name="close" size={24} color="#000" />
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
                  <Ionicons name="checkmark" size={20} color="hsl(210, 95%, 55%)" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  textArea: {
    minHeight: 100,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#000',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  createButton: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    color: '#000',
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
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionSelected: {
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
  },
});
