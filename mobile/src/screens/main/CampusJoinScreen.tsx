import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

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
      
      if (response.devCode) {
        Alert.alert(
          'Verification Code',
          `Your verification code is: ${response.devCode}\n\nCampus: ${response.campusName}`,
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>

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
          style={[isLoading && styles.buttonDisabled]}
          onPress={handleVerifyEmail}
          disabled={isLoading}
        >
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={styles.verifyButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify My .edu Email</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Bubble is not managed by or affiliated with your school
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    backgroundColor: Colors.neutral.cloudGrey,
  },
  verifyButton: {
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },
});
