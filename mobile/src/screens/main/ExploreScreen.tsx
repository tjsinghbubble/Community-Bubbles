import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';

const MOCK_BUBBLES = [
  {
    id: 'sf-pickleball',
    title: 'SF Pickleball Crew',
    category: 'Sports',
    distance: '9.7 mi',
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400',
  },
  {
    id: 'mindful-mamas',
    title: 'Mindful Mamas',
    category: 'Wellness',
    distance: '8.2 mi',
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
  },
  {
    id: 'bark-dogpatch',
    title: 'Bark at Dogpatch',
    category: 'Animals',
    distance: '9.1 mi',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
  },
];

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bubbles in San Francisco</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {MOCK_BUBBLES.map((bubble) => (
          <TouchableOpacity key={bubble.id} style={styles.card}>
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
  },
  header: {
    padding: 20,
    paddingTop: 16,
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
