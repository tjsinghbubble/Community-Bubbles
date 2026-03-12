import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_ASKED_MEDIA_LIBRARY = 'permissions_hasAskedMediaLibrary';
const HAS_ASKED_CAMERA = 'permissions_hasAskedCamera';

function showPrePrompt(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

function showSettingsAlert(type: 'photos' | 'camera'): Promise<boolean> {
  const noun = type === 'photos' ? 'photo library' : 'camera';
  return new Promise((resolve) => {
    Alert.alert(
      `${noun.charAt(0).toUpperCase() + noun.slice(1)} Access Needed`,
      `You previously denied ${noun} access. To use this feature, please enable it in your device Settings.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
            resolve(false);
          },
        },
      ]
    );
  });
}

export async function requestPhotoLibraryAccess(): Promise<boolean> {
  const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (currentStatus === 'granted') {
    return true;
  }

  const hasAsked = await AsyncStorage.getItem(HAS_ASKED_MEDIA_LIBRARY);

  if (hasAsked === 'true') {
    await showSettingsAlert('photos');
    return false;
  }

  const proceed = await showPrePrompt(
    'Photo Access',
    'Bubble needs access to your photos so you can upload profile pictures, share images in your communities, and add photos to events.'
  );

  if (!proceed) {
    return false;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  await AsyncStorage.setItem(HAS_ASKED_MEDIA_LIBRARY, 'true');

  return status === 'granted';
}

export async function requestCameraAccess(): Promise<boolean> {
  const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();

  if (currentStatus === 'granted') {
    return true;
  }

  const hasAsked = await AsyncStorage.getItem(HAS_ASKED_CAMERA);

  if (hasAsked === 'true') {
    await showSettingsAlert('camera');
    return false;
  }

  const proceed = await showPrePrompt(
    'Camera Access',
    'Bubble needs access to your camera so you can take photos to share in your communities and events.'
  );

  if (!proceed) {
    return false;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  await AsyncStorage.setItem(HAS_ASKED_CAMERA, 'true');

  return status === 'granted';
}
