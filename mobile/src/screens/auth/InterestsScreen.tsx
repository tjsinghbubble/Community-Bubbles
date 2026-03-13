import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Interests'>;
  route: RouteProp<AuthStackParamList, 'Interests'>;
};

const INTERESTS = [
  { id: 'running', label: 'Running', image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&h=300&fit=crop' },
  { id: 'cooking', label: 'Cooking', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300&h=300&fit=crop' },
  { id: 'coffee', label: 'Coffee Meets', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
  { id: 'gardening', label: 'Gardening', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=300&fit=crop' },
  { id: 'yoga', label: 'Yoga', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=300&fit=crop' },
  { id: 'tennis', label: 'Tennis', image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=300&h=300&fit=crop' },
  { id: 'biking', label: 'Biking', image: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=300&h=300&fit=crop' },
  { id: 'pets', label: 'Pets', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=300&fit=crop' },
  { id: 'photography', label: 'Photography', image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=300&h=300&fit=crop' },
  { id: 'hiking', label: 'Hiking', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=300&h=300&fit=crop' },
  { id: 'music', label: 'Music', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { id: 'art', label: 'Art', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop' },
  { id: 'gaming', label: 'Gaming', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&h=300&fit=crop' },
  { id: 'reading', label: 'Reading', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop' },
  { id: 'fitness', label: 'Fitness', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=300&fit=crop' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 8;
const CARD_GAP = 8;
const NUM_COLUMNS = 3;
const AVAILABLE_WIDTH = SCREEN_WIDTH - GRID_PADDING * 2;
const CARD_SIZE = Math.floor((AVAILABLE_WIDTH - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

const MIN_SELECTIONS = 3;
const PROGRESS_STEP = 0.75;

export default function InterestsScreen({ navigation, route }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const { name, email, password, gender, dateOfBirth, profilePhotoUri } = route.params;

  const toggleInterest = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length >= MIN_SELECTIONS) {
      navigation.navigate('Guidelines', {
        name,
        email,
        password,
        gender,
        dateOfBirth,
        interests: selected,
        profilePhotoUri,
      });
    }
  };

  const remaining = Math.max(0, MIN_SELECTIONS - selected.length);
  const canContinue = selected.length >= MIN_SELECTIONS;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          data-testid="button-back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack} />
        <View style={[styles.progressFill, { width: `${PROGRESS_STEP * 100}%` }]} />
      </View>

      <Text style={styles.title} data-testid="text-title">Tell us your interests</Text>

      <Text style={styles.subtitle} data-testid="text-subtitle">
        Select at least 3 to continue
      </Text>

      <FlatList
        data={INTERESTS}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item: interest }) => {
          const isSelected = selected.includes(interest.id);
          return (
            <View style={styles.cardWrapper}>
              <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleInterest(interest.id)}
                activeOpacity={0.8}
                data-testid={`button-interest-${interest.id}`}
              >
                <Image
                  source={{ uri: interest.image }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                {isSelected && (
                  <View style={styles.selectedOverlay}>
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              <Text
                style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}
                data-testid={`text-interest-${interest.id}`}
              >
                {interest.label}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <BubbleButton
          title={canContinue ? 'Continue' : `Select ${remaining} more`}
          onPress={handleContinue}
          disabled={!canContinue}
          testID="button-continue"
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 38,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    height: 2,
    position: 'relative',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#DDDDDD',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    backgroundColor: '#35A8F7',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1F26',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4D4D4D',
    textAlign: 'center',
    marginTop: 34,
    marginBottom: 8,
  },
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 120,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  cardWrapper: {
    width: CARD_SIZE,
    alignItems: 'center',
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#35A8F7',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(53, 168, 247, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#35A8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4D4D4D',
    textAlign: 'center',
    marginTop: 6,
  },
  cardLabelSelected: {
    color: '#35A8F7',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingBottom: 40,
    paddingTop: 16,
  },
  button: {
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 80,
  },
  buttonDisabled: {
    backgroundColor: '#969696',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
