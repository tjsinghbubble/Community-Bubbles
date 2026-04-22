import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { NavHeader } from '../../components/ScreenHeader';
import apiService from '../../services/api.service';
import { API_URL } from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Guidelines'>;
  route: RouteProp<AuthStackParamList, 'Guidelines'>;
};

const GUIDELINES = [
  {
    id: 'kind',
    title: 'Be Kind',
    description: 'No bullying, harassment, or hateful behavior',
  },
  {
    id: 'privacy',
    title: 'Respect Privacy',
    description: "Don't share anyone's personal info, screenshots, or messages without permission",
  },
  {
    id: 'safe',
    title: 'Keep It Safe',
    description: 'No threats, dangerous behavior, or anything that could harm others',
  },
  {
    id: 'scams',
    title: 'No Scams or Spam',
    description: 'No fraud, promotions, or unwanted selling unless the Bubble allows it',
  },
  {
    id: 'content',
    title: 'Keep Content Appropriate',
    bullets: [
      'No graphic violence or gore',
      'No illegal content or promotion of illegal activities',
      'No misinformation intended to deceive or harm others',
    ],
  },
  {
    id: 'showup',
    title: 'Show Up',
    description: "Honor your commitments, whether you're hosting or attending",
  },
];

const WARNING = {
  title: 'Please Keep In Mind',
  description: 'Violations of these guidelines will result in warnings. Continued violations may lead to removal from Bubbles or account termination.',
};

export default function GuidelinesScreen({ navigation, route }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();

  const uploadProfilePhoto = async (profilePhotoUri: string) => {
    const photoResponse = await fetch(profilePhotoUri);
    const blob = await photoResponse.blob();
    const ext = profilePhotoUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const token = apiService.getToken();

    const uploadRes = await fetch(`${API_URL}/api/uploads/request-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name: `profile.${ext}`, contentType: mimeType }),
    });
    const uploadData = await uploadRes.json();

    if (uploadData.uploadURL) {
      await fetch(uploadData.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      const photoUrl = uploadData.objectPath.startsWith('http')
        ? uploadData.objectPath
        : `${API_URL}${uploadData.objectPath}`;
      await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ profilePhoto: photoUrl }),
      });
    }
  };

  const handleAgree = async () => {
    setIsLoading(true);
    try {
      const { name, email, password, interests, profilePhotoUri } = route.params;
      await signup(name, email, password, interests);
      setIsLoading(false);
      if (profilePhotoUri) {
        uploadProfilePhoto(profilePhotoUri).catch((photoErr) =>
          console.log('Profile photo upload failed (non-blocking):', photoErr)
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Signup Failed', error.message || 'Something went wrong');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader onBack={() => navigation.goBack()} />

      <View style={styles.progressContainer}>
        <View style={styles.progressFill} />
      </View>

      <Text style={styles.title} data-testid="text-title">Our Community Guidelines</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle} data-testid="text-section-title">
          Let's Keep This Space Safe
        </Text>

        <View style={styles.cardsContainer}>
          {GUIDELINES.map((guideline) => (
            <View key={guideline.id} style={styles.card} data-testid={`card-guideline-${guideline.id}`}>
              <Text style={styles.cardTitle}>{guideline.title}</Text>
              {guideline.description ? (
                <Text style={styles.cardDescription}>{guideline.description}</Text>
              ) : null}
              {guideline.bullets ? (
                <View style={styles.bulletList}>
                  {guideline.bullets.map((bullet, index) => (
                    <View key={index} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>{'\u2022'}</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          <View style={styles.warningCard} data-testid="card-warning">
            <Text style={styles.cardTitle}>{WARNING.title}</Text>
            <Text style={styles.cardDescription}>{WARNING.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <BubbleButton
          title="I Agree"
          onPress={handleAgree}
          disabled={isLoading}
          loading={isLoading}
          testID="button-agree"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  progressContainer: {
    height: 2,
    backgroundColor: '#DDDDDD',
  },
  progressFill: {
    height: 2,
    width: '100%',
    backgroundColor: '#35A8F7',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1F26',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 8,
  },
  card: {
    backgroundColor: '#F5F6F8',
    borderRadius: 20,
    padding: 12,
  },
  warningCard: {
    backgroundColor: '#F5F6F8',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#35A8F7',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
  },
  bulletList: {
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: '#000000',
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});
