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
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import cometChatService from '../../services/cometchat.service';

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
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportFreeText, setReportFreeText] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const REPORT_REASONS = [
    'Harassment or inappropriate behavior',
    'Made me feel unsafe or uncomfortable',
    'Fake profile or suspected scammer',
    'No-show pattern',
    'Other',
  ];

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

  const handleKebabPress = (member: Member) => {
    setSelectedMember(member);
    setMenuVisible(true);
  };

  const handleDirectMessage = async () => {
    setMenuVisible(false);
    if (!selectedMember) return;
    try {
      const result = await apiService.initiateAdminDm(bubbleId, selectedMember.userId);
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.navigate('Messages', {
          screen: 'MessagesList',
          params: { openGroupId: result.groupId },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start admin conversation. Please try again.');
    }
  };

  const handleRemoveFromGroup = () => {
    setMenuVisible(false);
    if (!selectedMember) return;
    const member = selectedMember;
    Alert.alert(
      `Remove '${member.user.name}' from '${bubbleTitle}'?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeMember(bubbleId, member.userId);
              setMembers(prev => prev.filter(m => m.userId !== member.userId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleMakeAdmin = () => {
    setMenuVisible(false);
    if (!selectedMember) return;
    const member = selectedMember;
    Alert.alert(
      `Make '${member.user.name}' Admin for '${bubbleTitle}'?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateMemberRole(member.userId, 'admin'),
        },
      ]
    );
  };

  const handleDemoteFromMenu = () => {
    setMenuVisible(false);
    if (!selectedMember) return;
    handleDemote(selectedMember);
  };

  const handleReportConcern = () => {
    setMenuVisible(false);
    if (!selectedMember) return;
    setReportReason(null);
    setReportFreeText('');
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!reportReason || !selectedMember) return;
    setReportSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'individual',
        reason: reportReason,
        freeText: reportFreeText.trim() || undefined,
        reportedUserId: selectedMember.userId,
        bubbleId,
      });
      setReportModalVisible(false);
      const isReportedAdmin = selectedMember.role === 'admin';
      Alert.alert(
        'Report Submitted',
        isReportedAdmin
          ? 'Your concern has been sent to the other admins and super admins for review.'
          : 'Your concern has been sent to the bubble admins for review.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
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
  const uniqueMembers = members.reduce<Member[]>((acc, m) => {
    const existing = acc.find(x => x.userId === m.userId);
    if (!existing) {
      acc.push(m);
    } else if (m.role === 'admin' && existing.role !== 'admin') {
      acc[acc.indexOf(existing)] = m;
    }
    return acc;
  }, []);
  const admins = uniqueMembers.filter(m => m.role === 'admin');
  const regularMembers = uniqueMembers.filter(m => m.role === 'member');

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

        {!isMe && (
          <TouchableOpacity style={styles.kebabButton} onPress={() => handleKebabPress(item)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
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

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            {isAdmin && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleDirectMessage}>
                  <Text style={[styles.menuItemText, { color: Colors.neutral.charcoal }]}>Direct Message</Text>
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.neutral.charcoal} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleRemoveFromGroup}>
                  <Text style={[styles.menuItemText, { color: Colors.status.error }]}>Remove from group</Text>
                  <Ionicons name="person-remove-outline" size={18} color={Colors.status.error} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                {selectedMember?.role === 'admin' ? (
                  <TouchableOpacity style={styles.menuItem} onPress={handleDemoteFromMenu}>
                    <Text style={[styles.menuItemText, { color: '#f59e0b' }]}>Remove as admin</Text>
                    <Ionicons name="arrow-down" size={18} color="#f59e0b" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.menuItem} onPress={handleMakeAdmin}>
                    <Text style={[styles.menuItemText, { color: '#16a34a' }]}>Make admin</Text>
                    <Ionicons name="star-outline" size={18} color="#16a34a" />
                  </TouchableOpacity>
                )}
                <View style={styles.menuDivider} />
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleReportConcern}>
              <Text style={[styles.menuItemText, { color: Colors.neutral.charcoal }]}>Report a concern</Text>
              <Ionicons name="flag-outline" size={18} color={Colors.status.error} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>


      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.reportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.reportDialog}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report a Concern</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportSubtitle}>
              About {selectedMember?.user.name} — sent to bubble admins
            </Text>
            <ScrollView style={styles.reportReasonsList} nestedScrollEnabled>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportReasonItem,
                    reportReason === reason && styles.reportReasonSelected,
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[
                    styles.reportReasonText,
                    reportReason === reason && styles.reportReasonTextSelected,
                  ]}>{reason}</Text>
                  {reportReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.reportTextInput}
              placeholder="Additional details (optional)"
              placeholderTextColor={Colors.text.tertiary}
              value={reportFreeText}
              onChangeText={setReportFreeText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reportSubmitButton, !reportReason && styles.reportSubmitDisabled]}
              onPress={submitReport}
              disabled={!reportReason || reportSubmitting}
            >
              {reportSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  kebabButton: {
    padding: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: 20,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  reportDialog: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
  },
  reportSubtitle: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginBottom: 16,
  },
  reportReasonsList: {
    maxHeight: 250,
  },
  reportReasonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
    marginBottom: 8,
  },
  reportReasonSelected: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: '#eef7ff',
  },
  reportReasonText: {
    fontSize: 14,
    color: Colors.neutral.charcoal,
    flex: 1,
  },
  reportReasonTextSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
  reportTextInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    fontSize: 14,
    color: Colors.neutral.charcoal,
    minHeight: 80,
  },
  reportSubmitButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  reportSubmitDisabled: {
    opacity: 0.5,
  },
  reportSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.skyWhite,
  },
});
