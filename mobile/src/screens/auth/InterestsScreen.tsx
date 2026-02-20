import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Interests'>;
  route: RouteProp<AuthStackParamList, 'Interests'>;
};

const INTERESTS = [
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'wellness', label: 'Wellness', emoji: '🧘' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'games', label: 'Games', emoji: '🎮' },
  { id: 'outdoors', label: 'Outdoors', emoji: '🏕️' },
  { id: 'pets', label: 'Pets', emoji: '🐕' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 'social', label: 'Social', emoji: '🎉' },
];

export default function InterestsScreen({ navigation, route }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const { name, email, password } = route.params;

  const toggleInterest = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length >= 3) {
      navigation.navigate('Guidelines', { 
        name, 
        email, 
        password, 
        interests: selected 
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What are you into?</Text>
        <Text style={styles.subtitle}>
          Pick at least 3 interests to find your community
        </Text>
        <Text style={styles.counter}>
          {selected.length} selected {selected.length >= 3 && '✓'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
        {INTERESTS.map((interest) => {
          const isSelected = selected.includes(interest.id);
          return (
            <TouchableOpacity
              key={interest.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggleInterest(interest.id)}
            >
              <Text style={styles.emoji}>{interest.emoji}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {interest.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={selected.length < 3}
        >
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={[styles.button, selected.length < 3 && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Continue</Text>
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
    marginBottom: 16,
  },
  counter: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.bubbleBlue,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  card: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: 'hsl(210, 95%, 95%)',
    borderColor: Colors.brand.bubbleBlue,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
  },
  labelSelected: {
    color: Colors.brand.bubbleBlue,
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
