import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';
import { CheckboxIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Guidelines'>;
  route: RouteProp<AuthStackParamList, 'Guidelines'>;
};

const GUIDELINES = [
  {
    id: 'respect',
    title: 'Be respectful',
    description: 'Treat everyone with kindness and respect.',
  },
  {
    id: 'authentic',
    title: 'Stay authentic',
    description: 'Be yourself and build genuine connections.',
  },
  {
    id: 'safe',
    title: 'Keep it safe',
    description: 'Report anything that makes you uncomfortable.',
  },
  {
    id: 'inclusive',
    title: 'Be inclusive',
    description: 'Welcome everyone, regardless of background.',
  },
];

export default function GuidelinesScreen({ navigation, route }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();

  const handleGetStarted = async () => {
    if (!accepted) return;
    
    setIsLoading(true);
    try {
      const { name, email, password, interests } = route.params;
      await signup(name, email, password, interests);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Community Guidelines</Text>
          <Text style={styles.subtitle}>
            Let's keep Bubble welcoming for everyone
          </Text>
        </View>

        <View style={styles.guidelines}>
          {GUIDELINES.map((guideline) => (
            <View key={guideline.id} style={styles.card}>
              <Text style={styles.cardTitle}>{guideline.title}</Text>
              <Text style={styles.cardDescription}>
                {guideline.description}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setAccepted(!accepted)}
        >
          <CheckboxIcon size={18} checked={accepted} />
          <Text style={styles.checkboxLabel}>
            I agree to follow these community guidelines
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleGetStarted}
          disabled={!accepted || isLoading}
        >
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={[styles.button, (!accepted || isLoading) && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
  },
  scroll: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
  },
  guidelines: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    lineHeight: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
  },
  checkmark: {
    color: Colors.brand.skyWhite,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral.charcoal,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
  },
  button: {
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
