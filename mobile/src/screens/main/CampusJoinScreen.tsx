import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function CampusJoinScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your school email address');
      return;
    }

    if (!email.includes('@') || !email.endsWith('.edu')) {
      Alert.alert('Error', 'Please enter a valid .edu email address');
      return;
    }

    setIsLoading(true);
    apiService.setToken(token);

    try {
      const response = await apiService.sendCampusVerification(email.trim());
      
      if (response.emailFailed && response.fallbackCode) {
        Alert.alert(
          'Email Delivery Failed',
          `We couldn't send the email, but your verification code is:\n\n${response.fallbackCode}\n\nCampus: ${response.campusName}\n\nPlease copy it before continuing.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('CampusVerify', {
                  email: email.trim(),
                  campusName: response.campusName,
                });
              },
            },
          ]
        );
      } else {
        navigation.navigate('CampusVerify', {
          email: email.trim(),
          campusName: response.campusName,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.graduationIcon}>🎓</Text>
          </View>

          <Text style={styles.title}>Join your campus community!</Text>
          <Text style={styles.subtitle}>
            Find bubbles for classes, clubs, and common interests shared by people at your school.
          </Text>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Enter school email address</Text>
            <TextInput
              style={styles.input}
              placeholder="School email address"
              placeholderTextColor={Colors.neutral.coolMist}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            onPress={handleVerifyEmail}
            disabled={isLoading}
            activeOpacity={0.7}
            style={styles.verifyButton}
            testID="button-verify-edu-email"
          >
            <LinearGradient
              colors={['#35A8F7', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 3.6 }}
              style={styles.verifyBtnGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify My .edu Email</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Bubble is not managed by or affiliated with your school
          </Text>
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
    padding: 24,
    flexGrow: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  graduationIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.background.primary,
  },
  verifyButton: {
    width: '100%',
    marginBottom: 16,
  },
  verifyBtnGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#1E1F26',
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },
});
