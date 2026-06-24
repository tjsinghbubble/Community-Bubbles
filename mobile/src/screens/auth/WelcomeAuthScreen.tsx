import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { BubbleLogoIcon } from '../../components/icons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'WelcomeAuth'>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GRID_IMAGES = [
  require('../../assets/images/LandingPage/pickleball.jpg'),
  require('../../assets/images/LandingPage/dog_meeting.png'),
  require('../../assets/images/LandingPage/volunteer_group.png'),
  require('../../assets/images/LandingPage/group_cheers.jpg'),
  require('../../assets/images/LandingPage/fitness_class.jpg'),
  require('../../assets/images/LandingPage/picnic.jpg'),
  require('../../assets/images/LandingPage/group_craft.jpg'),
  require('../../assets/images/LandingPage/badminton.jpg'),
  require('../../assets/images/LandingPage/mask_group.jpg'),
];

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
});

export default function WelcomeAuthScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { loginWithSocialToken } = useAuth();

  const isEmailValid = EMAIL_REGEX.test(email.trim());

  const handleContinue = useCallback(async () => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) return;

    setCheckingEmail(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check email');

      if (data.exists) {
        navigation.navigate('Login', { email: trimmed });
      } else {
        navigation.navigate('Signup', { prefillEmail: trimmed });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  }, [email, navigation]);

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) throw new Error('No Google ID token received');

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Sign In failed');

      await loginWithSocialToken(data.token, data.user);

      if (data.isNewUser || data.user.socialAuthPending) {
        navigation.navigate('SocialProfile', {
          token: data.token,
          prefillName: data.googleName || data.user.name || '',
          provider: 'google',
        });
      }
      // If existing user, loginWithSocialToken handles navigation via AuthContext
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED' && err.code !== -5) {
        Alert.alert('Google Sign In Failed', err.message || 'Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithSocialToken, navigation]);

  const handleApple = useCallback(async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const res = await fetch(`${API_URL}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          fullName: credential.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Apple Sign In failed');

      await loginWithSocialToken(data.token, data.user);

      if (data.isNewUser || data.user.socialAuthPending) {
        navigation.navigate('SocialProfile', {
          token: data.token,
          prefillName: data.appleName || data.user.name || '',
          provider: 'apple',
        });
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In Failed', err.message || 'Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  }, [loginWithSocialToken, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoGrid}>
            {GRID_IMAGES.map((img, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={img} style={styles.photo} resizeMode="cover" />
              </View>
            ))}
          </View>

          <View style={styles.branding}>
            <View style={styles.logoRow}>
              <BubbleLogoIcon width={36} height={33} />
              <Text style={styles.logoText}>Bubble</Text>
            </View>
            <Text style={styles.tagline}>Connect locally. Build lasting community.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Log in or sign up</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.neutral.coolMist}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleContinue}
                testID="input-email"
                accessibilityLabel="Email address"
              />
            </View>

            <BubbleButton
              title="Continue"
              onPress={handleContinue}
              disabled={!isEmailValid || checkingEmail}
              loading={checkingEmail}
              testID="button-continue"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogle}
                disabled={googleLoading}
                testID="button-google-signin"
                accessibilityLabel="Continue with Google"
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={Colors.neutral.charcoal} />
                ) : (
                  <GoogleIcon />
                )}
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={handleApple}
                  disabled={appleLoading}
                  testID="button-apple-signin"
                  accessibilityLabel="Continue with Apple"
                >
                  {appleLoading ? (
                    <ActivityIndicator size="small" color={Colors.neutral.charcoal} />
                  ) : (
                    <AppleIcon />
                  )}
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.legalText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.legalLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <View style={iconStyles.container}>
      <Text style={iconStyles.gText}>G</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 18,
  },
});

function AppleIcon() {
  return (
    <View style={appleIconStyles.container}>
      <Text style={appleIconStyles.text}></Text>
    </View>
  );
}

const appleIconStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
    color: '#000000',
    lineHeight: 24,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.skyWhite },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  photoWrapper: { width: '30%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  branding: { alignItems: 'center', paddingVertical: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  logoText: { fontSize: 26, fontWeight: '700', color: Colors.brand.bubbleBlue },
  tagline: { fontSize: 15, color: Colors.neutral.coolMist, textAlign: 'center' },
  card: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: 20,
    gap: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  inputGroup: {},
  input: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border.default },
  dividerText: { fontSize: 14, color: Colors.neutral.coolMist },
  socialButtons: { gap: 12 },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand.skyWhite,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  legalText: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
});
