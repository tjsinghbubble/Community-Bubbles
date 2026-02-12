import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

type PendingBubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  creatorId: string;
  createdAt: string;
};

type PendingEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  bubbleId: string;
  bubble: {
    id: string;
    title: string;
  };
  createdAt: string;
};

export default function PendingReviewsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [pendingBubbles, setPendingBubbles] = useState<PendingBubble[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isSuperAdmin = user?.isSuperAdmin === true;

  useFocusEffect(
    useCallback(() => {
      loadPendingItems();
    }, [])
  );

  const loadPendingItems = async () => {
    try {
      if (isSuperAdmin) {
        const bubbles = await apiService.getPendingBubbles();
        setPendingBubbles(bubbles);
      }
      
      const events = await apiService.getPendingEvents();
      setPendingEvents(events);
    } catch (error) {
      console.error('Failed to load pending items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPendingItems();
  };

  const handleApproveBubble = async (bubbleId: string) => {
    setActionLoading(bubbleId);
    try {
      await apiService.approveBubble(bubbleId);
      setPendingBubbles(prev => prev.filter(b => b.id !== bubbleId));
      Alert.alert('Approved', 'Bubble has been approved and is now visible');
    } catch (error) {
      Alert.alert('Error', 'Failed to approve bubble');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBubble = (bubbleId: string) => {
    Alert.prompt(
      'Reject Bubble',
      'Enter a reason for rejection (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setActionLoading(bubbleId);
            try {
              await apiService.rejectBubble(bubbleId, reason);
              setPendingBubbles(prev => prev.filter(b => b.id !== bubbleId));
              Alert.alert('Rejected', 'Bubble has been rejected');
            } catch (error) {
              Alert.alert('Error', 'Failed to reject bubble');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleApproveEvent = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await apiService.approveEvent(eventId);
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      Alert.alert('Approved', 'Event has been approved and is now visible');
    } catch (error) {
      Alert.alert('Error', 'Failed to approve event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectEvent = (eventId: string) => {
    Alert.prompt(
      'Reject Event',
      'Enter a reason for rejection (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setActionLoading(eventId);
            try {
              await apiService.rejectEvent(eventId, reason);
              setPendingEvents(prev => prev.filter(e => e.id !== eventId));
              Alert.alert('Rejected', 'Event has been rejected');
            } catch (error) {
              Alert.alert('Error', 'Failed to reject event');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  const hasPendingItems = pendingBubbles.length > 0 || pendingEvents.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Reviews</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {!hasPendingItems ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.neutral.coolMist} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No items pending review</Text>
          </View>
        ) : (
          <>
            {isSuperAdmin && pendingBubbles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Bubbles</Text>
                {pendingBubbles.map(bubble => (
                  <View key={bubble.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardCategory}>
                        <Text style={styles.categoryText}>{bubble.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{bubble.title}</Text>
                    <Text style={styles.cardSubtitle}>{bubble.tagline}</Text>
                    
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectBubble(bubble.id)}
                        disabled={actionLoading === bubble.id}
                      >
                        {actionLoading === bubble.id ? (
                          <ActivityIndicator size="small" color={Colors.state.error} />
                        ) : (
                          <>
                            <Ionicons name="close" size={18} color={Colors.state.error} />
                            <Text style={styles.rejectText}>Reject</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => handleApproveBubble(bubble.id)}
                        disabled={actionLoading === bubble.id}
                      >
                        <LinearGradient
                          colors={Gradients.button.colors as unknown as string[]}
                          start={Gradients.button.start}
                          end={Gradients.button.end}
                          style={[styles.actionButton, styles.approveButton]}
                        >
                          {actionLoading === bubble.id ? (
                            <ActivityIndicator size="small" color={Colors.neutral.charcoal} />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={18} color={Colors.neutral.charcoal} />
                              <Text style={styles.approveText}>Approve</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {pendingEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Events</Text>
                {pendingEvents.map(event => (
                  <View key={event.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.bubbleTag}>
                        <Ionicons name="apps-outline" size={14} color={Colors.brand.bubbleBlue} />
                        <Text style={styles.bubbleTagText}>{event.bubble?.title || 'Unknown Bubble'}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{event.title}</Text>
                    <View style={styles.eventMeta}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.neutral.coolMist} />
                      <Text style={styles.eventMetaText}>
                        {formatDate(event.date)} at {event.startTime}
                      </Text>
                    </View>
                    
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectEvent(event.id)}
                        disabled={actionLoading === event.id}
                      >
                        {actionLoading === event.id ? (
                          <ActivityIndicator size="small" color={Colors.state.error} />
                        ) : (
                          <>
                            <Ionicons name="close" size={18} color={Colors.state.error} />
                            <Text style={styles.rejectText}>Reject</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => handleApproveEvent(event.id)}
                        disabled={actionLoading === event.id}
                      >
                        <LinearGradient
                          colors={Gradients.button.colors as unknown as string[]}
                          start={Gradients.button.start}
                          end={Gradients.button.end}
                          style={[styles.actionButton, styles.approveButton]}
                        >
                          {actionLoading === event.id ? (
                            <ActivityIndicator size="small" color={Colors.neutral.charcoal} />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={18} color={Colors.neutral.charcoal} />
                              <Text style={styles.approveText}>Approve</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.brand.skyWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginTop: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardCategory: {
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  bubbleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bubbleTagText: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  eventMetaText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.coolMist,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#FFF0F0',
  },
  approveButton: {
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.state.error,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
});
