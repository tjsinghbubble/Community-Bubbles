import React, { useState, useCallback } from 'react';
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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ExploreStackParamList, BubbleData } from '../../navigation/ExploreNavigator';
import { API_URL } from '../../config/api';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'ExploreList'>;

export default function ExploreScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBubbles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bubbles`);
      const data = await response.json();
      
      // Transform API response to match BubbleData type
      const transformedBubbles: BubbleData[] = data.map((bubble: any) => ({
        id: bubble.id,
        title: bubble.title,
        tagline: bubble.tagline,
        category: bubble.category,
        description: bubble.description,
        members: bubble.members || 0,
        image: bubble.coverImage || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400',
        distance: '~', // Distance calculation would require location services
      }));
      
      setBubbles(transformedBubbles);
    } catch (error) {
      console.error('Failed to fetch bubbles:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBubbles();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBubbles();
  };

  const handleBubblePress = (bubble: BubbleData) => {
    navigation.navigate('BubbleDetails', { bubble });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore Bubbles</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  if (bubbles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore Bubbles</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.empty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text style={styles.emptyTitle}>No bubbles yet</Text>
          <Text style={styles.emptySubtitle}>
            Be the first to create a bubble in your area!
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Bubbles</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {bubbles.map((bubble) => (
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
              <Text style={styles.cardTitle} numberOfLines={1}>{bubble.title}</Text>
              <Text style={styles.cardTagline} numberOfLines={1}>{bubble.tagline}</Text>
              <Text style={styles.memberCount}>{bubble.members} members</Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  grid: {
    padding: 20,
    paddingTop: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#e0e0e0',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  cardTagline: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  memberCount: {
    fontSize: 11,
    color: '#888',
  },
});
