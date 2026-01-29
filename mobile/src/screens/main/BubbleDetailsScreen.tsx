import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BubbleDetails'>;
  route: RouteProp<ExploreStackParamList, 'BubbleDetails'>;
};

export default function BubbleDetailsScreen({ navigation, route }: Props) {
  const { bubble } = route.params;
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);

  const handleJoinLeave = async () => {
    if (!user) return;
    
    setIsJoining(true);
    try {
      if (isMember) {
        await apiService.leaveBubble(bubble.id);
        setIsMember(false);
        Alert.alert('Left', `You left ${bubble.title}`);
      } else {
        await apiService.joinBubble(bubble.id);
        setIsMember(true);
        Alert.alert('Joined!', `Welcome to ${bubble.title}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Image 
          source={{ uri: bubble.image || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800' }} 
          style={styles.coverImage} 
        />
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{bubble.category}</Text>
          </View>
          
          <Text style={styles.title}>{bubble.title}</Text>
          <Text style={styles.tagline}>{bubble.tagline || 'A community for like-minded people'}</Text>
          
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{bubble.members || 0}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{bubble.distance || 'Nearby'}</Text>
              <Text style={styles.statLabel}>Away</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>
              {bubble.description || 'Join us to connect with amazing people in your area who share your interests!'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Guidelines</Text>
            <View style={styles.rules}>
              <Text style={styles.rule}>• Be respectful to all members</Text>
              <Text style={styles.rule}>• No spam or self-promotion</Text>
              <Text style={styles.rule}>• Keep discussions on topic</Text>
              <Text style={styles.rule}>• Have fun and make connections!</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.joinButton, isMember && styles.leaveButton]}
          onPress={handleJoinLeave}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.joinButtonText}>
              {isMember ? 'Leave Bubble' : 'Join Bubble'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  coverImage: {
    width: '100%',
    height: 250,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  rules: {
    gap: 8,
  },
  rule: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  joinButton: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  leaveButton: {
    backgroundColor: '#dc2626',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
