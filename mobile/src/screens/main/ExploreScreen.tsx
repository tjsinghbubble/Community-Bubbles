import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ExploreStackParamList, BubbleData } from '../../navigation/ExploreNavigator';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'ExploreList'>;

const MOCK_BUBBLES: BubbleData[] = [
  {
    id: 'sf-pickleball',
    title: 'SF Pickleball Crew',
    tagline: 'Smash, dink, and have fun!',
    category: 'Sports',
    distance: '9.7 mi',
    members: 127,
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400',
    description: 'Join the fastest growing pickleball community in San Francisco! We host weekly games, tournaments, and social events for players of all skill levels.',
  },
  {
    id: 'mindful-mamas',
    title: 'Mindful Mamas',
    tagline: 'Self-care for busy moms',
    category: 'Wellness',
    distance: '8.2 mi',
    members: 89,
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
    description: 'A supportive community for mothers who want to prioritize their mental health and well-being. Weekly meditation sessions and monthly retreats.',
  },
  {
    id: 'bark-dogpatch',
    title: 'Bark at Dogpatch',
    tagline: 'Where pups make friends',
    category: 'Pets',
    distance: '9.1 mi',
    members: 256,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
    description: 'The ultimate dog-lover community in Dogpatch! Join us for daily walks, weekend meetups, and pet-friendly events throughout the city.',
  },
];

export default function ExploreScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleBubblePress = (bubble: BubbleData) => {
    navigation.navigate('BubbleDetails', { bubble });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bubbles in San Francisco</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {MOCK_BUBBLES.map((bubble) => (
          <TouchableOpacity 
            key={bubble.id} 
            style={styles.card}
            onPress={() => handleBubblePress(bubble)}
          >
            <Image source={{ uri: bubble.image }} style={styles.image} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{bubble.category}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{bubble.title}</Text>
              <Text style={styles.cardDistance}>{bubble.distance}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 140,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardDistance: {
    fontSize: 12,
    color: '#666',
  },
});
