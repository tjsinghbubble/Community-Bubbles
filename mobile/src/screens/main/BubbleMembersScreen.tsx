import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type MembersStackParamList = {
  BubbleMembers: { bubbleId: string; bubbleTitle: string };
};

type Props = {
  navigation: NativeStackNavigationProp<MembersStackParamList, 'BubbleMembers'>;
  route: RouteProp<MembersStackParamList, 'BubbleMembers'>;
};

type Member = {
  id: string;
  userId: string;
  bubbleId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profilePhoto?: string | null;
  };
};

export default function BubbleMembersScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle } = route.params;
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
    checkMyRole();
  }, [bubbleId]);

  const fetchMembers = async () => {
    try {
      const data = await apiService.getBubbleMembers(bubbleId);
      setMembers(data as Member[]);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMyRole = async () => {
    try {
      const result = await apiService.checkMembership(bubbleId);
      setMyRole(result.role);
    } catch (error) {
      console.error('Failed to check role:', error);
    }
  };

  const handlePromote = (member: Member) => {
    Alert.alert(
      'Promote to Admin',
      `Make ${member.user.name} an admin of this bubble?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: () => updateMemberRole(member.userId, 'admin'),
        },
      ]
    );
  };

  const handleDemote = (member: Member) => {
    Alert.alert(
      'Remove Admin Rights',
      `Remove admin rights from ${member.user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => updateMemberRole(member.userId, 'member'),
        },
      ]
    );
  };

  const handleRelinquishAdmin = () => {
    const adminCount = members.filter(m => m.role === 'admin').length;
    
    if (adminCount <= 1) {
      Alert.alert(
        'Cannot Relinquish',
        'You are the only admin. Promote another member to admin first before stepping down.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Step Down as Admin',
      'Are you sure you want to give up your admin rights? You will become a regular member.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Step Down',
          style: 'destructive',
          onPress: relinquishAdmin,
        },
      ]
    );
  };

  const updateMemberRole = async (userId: string, role: string) => {
    setIsUpdating(userId);
    try {
      await apiService.updateMemberRole(bubbleId, userId, role);
      setMembers(prev => prev.map(m => 
        m.userId === userId ? { ...m, role } : m
      ));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsUpdating(null);
    }
  };

  const relinquishAdmin = async () => {
    setIsUpdating(user?.id || null);
    try {
      await apiService.relinquishAdmin(bubbleId);
      setMyRole('member');
      setMembers(prev => prev.map(m => 
        m.userId === user?.id ? { ...m, role: 'member' } : m
      ));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsUpdating(null);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const isAdmin = myRole === 'admin';
  const admins = members.filter(m => m.role === 'admin');
  const regularMembers = members.filter(m => m.role === 'member');

  const renderMember = ({ item }: { item: Member }) => {
    const isMe = item.userId === user?.id;
    const isItemAdmin = item.role === 'admin';
    
    return (
      <View style={styles.memberRow}>
        <View style={styles.avatarContainer}>
          {item.user.profilePhoto ? (
            <Image source={{ uri: item.user.profilePhoto }} style={[styles.avatarImage, isItemAdmin && styles.adminAvatarBorder]} />
          ) : (
            <View style={[styles.avatar, isItemAdmin && styles.adminAvatar]}>
              <Text style={styles.avatarText}>{getInitials(item.user.name)}</Text>
            </View>
          )}
          {isItemAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.brand.skyWhite} />
            </View>
          )}
        </View>
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.user.name} {isMe && '(You)'}
          </Text>
          <Text style={styles.memberRole}>
            {isItemAdmin ? 'Admin' : 'Member'}
          </Text>
        </View>

        {isAdmin && !isMe && (
          <View style={styles.actions}>
            {isUpdating === item.userId ? (
              <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} />
            ) : (
              <>
                {isItemAdmin ? (
                  <TouchableOpacity
                    style={styles.demoteButton}
                    onPress={() => handleDemote(item)}
                  >
                    <Ionicons name="arrow-down" size={16} color="#dc2626" />
                    <Text style={styles.demoteText}>Demote</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.promoteButton}
                    onPress={() => handlePromote(item)}
                  >
                    <Ionicons name="arrow-up" size={16} color={Colors.brand.bubbleBlue} />
                    <Text style={styles.promoteText}>Promote</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.brand.bubbleBlue} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Members</Text>
          <Text style={styles.headerSubtitle}>{bubbleTitle}</Text>
        </View>
      </View>

      {isAdmin && (
        <TouchableOpacity style={styles.relinquishButton} onPress={handleRelinquishAdmin}>
          <Ionicons name="exit-outline" size={18} color="#dc2626" />
          <Text style={styles.relinquishText}>Step down as admin</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {renderSectionHeader('Admins', admins.length)}
              {admins.map(member => (
                <React.Fragment key={member.id}>
                  {renderMember({ item: member })}
                </React.Fragment>
              ))}
              
              {renderSectionHeader('Members', regularMembers.length)}
              {regularMembers.map(member => (
                <React.Fragment key={member.id}>
                  {renderMember({ item: member })}
                </React.Fragment>
              ))}
            </>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.brand.skyWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  relinquishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brand.skyWhite,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  relinquishText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    backgroundColor: Colors.neutral.cloudGrey,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.skyWhite,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral.coolMist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  adminAvatar: {
    backgroundColor: Colors.brand.bubbleBlue,
  },
  adminAvatarBorder: {
    borderWidth: 2,
    borderColor: Colors.brand.bubbleBlue,
  },
  avatarText: {
    color: Colors.brand.skyWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  adminBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.state.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.brand.skyWhite,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  memberRole: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  promoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  promoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.bubbleBlue,
  },
  demoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  demoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
});
