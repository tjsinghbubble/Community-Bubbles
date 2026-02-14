import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import cometChatService from '../../services/cometchat.service';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type ParticipantsParamList = {
  EventParticipants: {
    eventId: string;
    eventTitle: string;
    bubbleId: string;
    bubbleTitle: string;
    bubblePrivacy?: string;
    eventCreatorId?: string;
  };
};

type Props = {
  navigation: NativeStackNavigationProp<ParticipantsParamList, 'EventParticipants'>;
  route: RouteProp<ParticipantsParamList, 'EventParticipants'>;
};

type Attendee = {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    profilePhoto?: string | null;
  };
};

type Member = {
  userId: string;
  role: string;
};

export default function EventParticipantsScreen({ navigation, route }: Props) {
  const { eventId, eventTitle, bubbleId, bubbleTitle, bubblePrivacy, eventCreatorId } = route.params;
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [bubbleMembers, setBubbleMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myBubbleRole, setMyBubbleRole] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Attendee | null>(null);
  const [privacy, setPrivacy] = useState<string>(bubblePrivacy || 'Public');

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [attendeesData, membersData] = await Promise.all([
        apiService.getEventAttendees(eventId) as Promise<Attendee[]>,
        apiService.getBubbleMembers(bubbleId) as Promise<any[]>,
      ]);
      setAttendees(attendeesData);
      setBubbleMembers(membersData.map((m: any) => ({ userId: m.userId, role: m.role })));

      const myMembership = membersData.find((m: any) => m.userId === user?.id);
      setMyBubbleRole(myMembership?.role || null);

      if (!bubblePrivacy) {
        try {
          const bubbleData = await apiService.getBubble(bubbleId) as any;
          setPrivacy(bubbleData?.privacy || 'Public');
        } catch (e) {
          console.log('Failed to fetch bubble privacy:', e);
        }
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = myBubbleRole === 'admin' || user?.isSuperAdmin === true;
  const isPublicBubble = privacy === 'Public';

  const getBubbleRole = (userId: string): string => {
    const member = bubbleMembers.find(m => m.userId === userId);
    return member?.role || 'member';
  };

  const uniqueAttendees = attendees.reduce<Attendee[]>((acc, a) => {
    if (!acc.find(x => x.userId === a.userId)) acc.push(a);
    return acc;
  }, []);

  const adminUserIds = new Set(uniqueAttendees.filter(a => getBubbleRole(a.userId) === 'admin').map(a => a.userId));
  const admins = uniqueAttendees.filter(a => adminUserIds.has(a.userId));
  const participants = uniqueAttendees.filter(a => !adminUserIds.has(a.userId));

  const mixedList = (() => {
    if (isPublicBubble) return [];
    const sorted = [...uniqueAttendees];
    sorted.sort((a, b) => {
      if (a.userId === eventCreatorId) return -1;
      if (b.userId === eventCreatorId) return 1;
      return 0;
    });
    return sorted;
  })();

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

  const handleKebabPress = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setMenuVisible(true);
  };

  const handleDirectMessage = async () => {
    setMenuVisible(false);
    if (!selectedAttendee) return;
    try {
      await cometChatService.createUserIfNotExists(selectedAttendee.userId, selectedAttendee.user.name);
      await cometChatService.sendDirectMessage(selectedAttendee.userId, `Hi ${selectedAttendee.user.name}!`);
      Alert.alert(
        'Message Sent',
        `A conversation with ${selectedAttendee.user.name} has been started. Check your Messages tab to continue chatting.`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send direct message. Please try again.');
    }
  };

  const handleRemoveFromGroup = () => {
    setMenuVisible(false);
    if (!selectedAttendee) return;
    setRemoveTarget(selectedAttendee);
    setRemoveModalVisible(true);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await apiService.removeMember(bubbleId, removeTarget.userId);
      setAttendees(prev => prev.filter(a => a.userId !== removeTarget.userId));
      setBubbleMembers(prev => prev.filter(m => m.userId !== removeTarget.userId));
      setRemoveModalVisible(false);
      setRemoveTarget(null);
      Alert.alert('Removed', `${removeTarget.user.name} has been removed from ${bubbleTitle}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove member');
      setRemoveModalVisible(false);
      setRemoveTarget(null);
    }
  };

  const handleMakeAdmin = async () => {
    setMenuVisible(false);
    if (!selectedAttendee) return;
    Alert.alert(
      'Make Admin',
      `Make ${selectedAttendee.user.name} an admin of ${bubbleTitle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await apiService.updateMemberRole(bubbleId, selectedAttendee.userId, 'admin');
              setBubbleMembers(prev => prev.map(m =>
                m.userId === selectedAttendee.userId ? { ...m, role: 'admin' } : m
              ));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update role');
            }
          },
        },
      ]
    );
  };

  const handleReportConcern = () => {
    setMenuVisible(false);
    if (!selectedAttendee) return;
    Alert.alert(
      'Report a Concern',
      `Report ${selectedAttendee.user.name}? This will be reviewed by our team.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Reported', 'Your concern has been submitted for review.');
          },
        },
      ]
    );
  };

  const renderAttendeeRow = (attendee: Attendee, showOrganizer?: boolean) => {
    const isMe = attendee.userId === user?.id;
    const isOrganizer = showOrganizer && attendee.userId === eventCreatorId;
    const displayName = isMe ? 'You' : attendee.user.name;

    return (
      <View style={styles.attendeeRow} key={attendee.id}>
        {attendee.user.profilePhoto ? (
          <Image source={{ uri: attendee.user.profilePhoto }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(attendee.user.name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {displayName}{isOrganizer ? '' : ''}
          </Text>
          {isOrganizer && (
            <Text style={styles.organizerLabel}>(Organizer)</Text>
          )}
        </View>
        {!isMe && (
          <TouchableOpacity style={styles.kebabButton} onPress={() => handleKebabPress(attendee)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Participants</Text>
        <View style={{ width: 32 }} />
      </View>

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
              {isPublicBubble ? (
                <>
                  {admins.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Admins</Text>
                      {admins.map(a => renderAttendeeRow(a))}
                    </>
                  )}

                  {admins.length > 0 && participants.length > 0 && (
                    <View style={styles.sectionSeparator} />
                  )}

                  {participants.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Participants</Text>
                      {participants.map(a => renderAttendeeRow(a))}
                    </>
                  )}
                </>
              ) : (
                <>
                  {mixedList.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Participants</Text>
                      {mixedList.map(a => renderAttendeeRow(a, true))}
                    </>
                  )}
                </>
              )}

              {attendees.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No participants yet</Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
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
                  <Text style={styles.menuItemText}>Direct Message</Text>
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.neutral.charcoal} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleRemoveFromGroup}>
                  <Text style={styles.menuItemText}>Remove from group</Text>
                  <Ionicons name="person-remove-outline" size={18} color={Colors.neutral.charcoal} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleMakeAdmin}>
                  <Text style={styles.menuItemText}>Make admin</Text>
                  <Ionicons name="star-outline" size={18} color={Colors.neutral.charcoal} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleReportConcern}>
              <Text style={styles.menuItemText}>Report a concern</Text>
              <Ionicons name="flag-outline" size={18} color={Colors.neutral.charcoal} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={removeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveModalVisible(false)}
      >
        <View style={styles.removeOverlay}>
          <View style={styles.removeDialog}>
            <Text style={styles.removeTitle}>
              Remove '{removeTarget?.user.name}' from '{bubbleTitle}'?
            </Text>
            <View style={styles.removeActions}>
              <TouchableOpacity onPress={() => { setRemoveModalVisible(false); setRemoveTarget(null); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRemove}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.cloudGrey,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: 20,
    marginTop: 8,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral.cloudGrey,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  attendeeName: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
  },
  organizerLabel: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  kebabButton: {
    padding: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.neutral.coolMist,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 12,
    width: 260,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: 16,
  },
  removeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeDialog: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 14,
    padding: 24,
    width: 280,
    alignItems: 'center',
  },
  removeTitle: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  removeActions: {
    flexDirection: 'row',
    gap: 40,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  removeText: {
    fontSize: 16,
    color: Colors.state.error,
    fontWeight: '500',
  },
});
