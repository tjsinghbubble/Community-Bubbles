import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';

type Bubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  members: number;
  coverImage: string | null;
  distance: string | null;
};

export default function MyBubblesScreen() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const fetchMyBubbles = async () => {
    try {
      const data = await apiService.getMyBubbles() as Bubble[];
      setBubbles(data);
    } catch (error) {
      console.error('Failed to fetch my bubbles:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMyBubbles();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyBubbles();
  };

  const handleBubblePress = (bubble: Bubble) => {
    navigation.navigate('Explore', {
      screen: 'BubbleDetails',
      params: {
        bubble: {
          id: bubble.id,
          title: bubble.title,
          tagline: bubble.tagline,
          category: bubble.category,
          members: bubble.members,
          image: bubble.coverImage,
          distance: bubble.distance,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  const handleCreateBubble = () => {
    navigation.navigate('CreateBubble' as never);
  };

  if (bubbles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Bubbles</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No bubbles yet</Text>
          <Text style={styles.emptySubtitle}>
            Join some bubbles from the Explore tab or create your own!
          </Text>
          <TouchableOpacity 
            style={styles.createFirstButton}
            onPress={handleCreateBubble}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createFirstButtonText}>Create a Bubble</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleCreateBubble}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bubbles</Text>
        <Text style={styles.headerCount}>{bubbles.length} joined</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
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
            <Image
              source={{
                uri: bubble.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400',
              }}
              style={styles.cardImage}
            />
            <View style={styles.cardContent}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{bubble.category}</Text>
              </View>
              <Text style={styles.cardTitle}>{bubble.title}</Text>
              <Text style={styles.cardTagline}>{bubble.tagline}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.memberCount}>{bubble.members} members</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity 
        style={styles.fab}
        onPress={handleCreateBubble}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  headerCount: {
    fontSize: 14,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  list: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardTagline: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#888',
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'hsl(210, 95%, 55%)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
