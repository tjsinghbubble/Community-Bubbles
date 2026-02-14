import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

interface MultiImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  addLabel?: string;
}

export default function MultiImagePicker({
  images,
  onImagesChange,
  maxImages = 5,
  disabled = false,
  addLabel,
}: MultiImagePickerProps) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can only add up to ${maxImages} images`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileName = uri.split('/').pop() || 'image.jpg';
      const contentType = blob.type || 'image/jpeg';
      
      const uploadUrlResponse = await fetch(`${API_URL}/api/uploads/request-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: fileName,
          size: blob.size,
          contentType,
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, objectPath } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const imageUrl = `${API_URL}${objectPath}`;
      onImagesChange([...images, imageUrl]);
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  const label = addLabel || (maxImages === 1 ? '+ Add' : '+ Add Attachments');

  return (
    <View style={styles.container}>
      {images.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.image} />
              {!disabled && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#ff4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      
      {!disabled && images.length < maxImages && (
        <TouchableOpacity
          style={styles.addButtonFull}
          onPress={pickImage}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#999" />
          ) : (
            <Text style={styles.addButtonLabel}>{label}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 120,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addButtonFull: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addButtonLabel: {
    fontSize: 14,
    color: '#969696',
  },
});
