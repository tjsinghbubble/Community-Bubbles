import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { Colors, Spacing, Typography } from '../../styles/theme';
import apiService from '../../services/api.service';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'AdminDashboard'>;
  route: RouteProp<ExploreStackParamList, 'AdminDashboard'>;
};

type Member = {
  userId: string;
  role: string;
  status: string;
  name?: string;
};

export default function AdminDashboardScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle, bubble } = route.params;

  const [members, setMembers] = useState<Member[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [membersData, waitlistData] = await Promise.all([
        apiService.getBubbleMembers(bubbleId) as Promise<Member[]>,
        apiService.getWaitlist(bubbleId) as Promise<any[]>,
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setWaitlistCount(Array.isArray(waitlistData) ? waitlistData.length : 0);
    } catch {
      setMembers([]);
      setWaitlistCount(0);
    } finally {
      setLoading(false);
    }
  }, [bubbleId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchStats();
    }, [fetchStats])
  );

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const adminCount = approvedMembers.filter((m) => m.role === 'admin').length;
  const memberCount = approvedMembers.length;
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const needsAttentionCount = pendingCount + waitlistCount;

  const handleManageMembers = () => {
    navigation.navigate('BubbleMembers', { bubbleId, bubbleTitle });
  };

  const handleManageWaitlist = () => {
    navigation.navigate('BubbleWaitlist', { bubbleId, bubbleTitle });
  };

  const handleEditBubble = () => {
    navigation.navigate('EditBubble', { bubble });
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent', { bubbleId, bubbleTitle });
  };

  const handleNeedsAttention = () => {
    navigation.navigate('BubbleMembers', { bubbleId, bubbleTitle });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{bubbleTitle} Dashboard</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{memberCount}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{adminCount}</Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{waitlistCount}</Text>
              <Text style={styles.statLabel}>Waitlisted</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Admin Controls</Text>
          <View style={styles.separator} />

          <View style={styles.buttonsGrid}>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.pillButton} onPress={handleManageMembers} activeOpacity={0.75}>
                <Text style={styles.pillButtonText}>Manage Members</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.pillButton} onPress={handleManageWaitlist} activeOpacity={0.75}>
                <Text style={styles.pillButtonText}>Manage Waitlist</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.pillButton} onPress={handleEditBubble} activeOpacity={0.75}>
                <Text style={styles.pillButtonText}>Edit Bubble Info</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.pillButton} onPress={handleCreateEvent} activeOpacity={0.75}>
                <View style={styles.pillButtonLeft}>
                  <Ionicons name="add" size={16} color={Colors.text.primary} />
                  <Text style={styles.pillButtonText}>Create Event</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.pillButton} onPress={handleNeedsAttention} activeOpacity={0.75}>
                <View style={styles.pillButtonLeft}>
                  <Ionicons name="alarm-outline" size={18} color={Colors.status.warning} />
                  <Text style={styles.pillButtonText}>Needs Attention</Text>
                  {needsAttentionCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{needsAttentionCount}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
              </TouchableOpacity>
              <View style={styles.pillButtonEmpty} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  statNumber: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: Typography.weights.regular as any,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginBottom: Spacing.lg,
  },
  buttonsGrid: {
    gap: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.primary,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border.default,
    height: 54,
    paddingHorizontal: Spacing.lg,
  },
  pillButtonEmpty: {
    flex: 1,
  },
  pillButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pillButtonText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.regular as any,
  },
  badge: {
    backgroundColor: Colors.status.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  badgeText: {
    fontSize: Typography.sizes.xs,
    color: '#FFFFFF',
    fontWeight: Typography.weights.bold as any,
  },
});
