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
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { requestPhotoLibraryAccess, requestCameraAccess } from '../utils/permissions';

interface MultiImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  addLabel?: string;
  acceptAllFiles?: boolean;
}

export default function MultiImagePicker({
  images,
  onImagesChange,
  maxImages = 5,
  disabled = false,
  addLabel,
  acceptAllFiles = false,
}: MultiImagePickerProps) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can only add up to ${maxImages} files`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri, result.assets[0].name, result.assets[0].mimeType);
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const takePhoto = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can only add up to ${maxImages} images`);
      return;
    }

    const granted = await requestCameraAccess();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const chooseFromLibrary = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can only add up to ${maxImages} images`);
      return;
    }

    const granted = await requestPhotoLibraryAccess();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    if (acceptAllFiles) {
      return pickFile();
    }

    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadImage = async (uri: string, fileName?: string, mimeType?: string) => {
    if (!uri) return;
    setUploading(true);
    try {
      let blob: Blob;
      try {
        const response = await fetch(uri);
        blob = await response.blob();
      } catch (fetchErr) {
        console.warn('Blob fetch failed, trying FormData approach:', fetchErr);
        const name = fileName || uri.split('/').pop() || 'image.jpg';
        const contentType = mimeType || 'image/jpeg';

        const uploadUrlResponse = await fetch(`${API_URL}/api/uploads/request-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ name, size: 0, contentType }),
        });
        if (!uploadUrlResponse.ok) throw new Error('Failed to get upload URL');
        const { uploadURL, objectPath } = await uploadUrlResponse.json();

        const formData = new FormData();
        formData.append('file', { uri, name, type: contentType } as any);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error('Failed to upload image');

        const imageUrl = `${API_URL}${objectPath}`;
        onImagesChange([...images, imageUrl]);
        return;
      }

      const name = fileName || uri.split('/').pop() || 'image.jpg';
      const contentType = mimeType || blob.type || 'image/jpeg';
      
      const uploadUrlResponse = await fetch(`${API_URL}/api/uploads/request-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
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

  const isImageUrl = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ||
      url.includes('/image') || !acceptAllFiles;
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'File';
  };

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
              {isImageUrl(uri) ? (
                <Image source={{ uri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.fileContainer]}>
                  <Ionicons name="document-outline" size={28} color="#969696" />
                  <Text style={styles.fileName} numberOfLines={1}>{getFileName(uri)}</Text>
                </View>
              )}
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
  fileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    gap: 4,
  },
  fileName: {
    fontSize: 10,
    color: '#969696',
    maxWidth: 100,
    textAlign: 'center',
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
