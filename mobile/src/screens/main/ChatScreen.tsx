import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LongPressGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, CardShadow } from '../../styles/theme';
import { FlowHeader } from '../../components/ScreenHeader';
import { PeopleIcon } from '../../components/icons';
import { requestPhotoLibraryAccess, requestCameraAccess } from '../../utils/permissions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { groupId: string; groupName: string };
};

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'Chat'>;
  route: RouteProp<MessagesStackParamList, 'Chat'>;
};

type Reaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type Message = {
  id: string;
  text: string;
  sentAt: number;
  sender: {
    uid: string;
    name: string;
    avatar?: string;
  };
  reactions: Reaction[];
  parentMessage?: {
    id: string;
    text: string;
    senderName: string;
  };
  type: 'text' | 'image';
  imageUrl?: string;
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EXPANDED_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏',
  '🔥', '👏', '🎉', '💯', '😍', '🤔',
  '😡', '💔', '🥳', '😎', '🤣', '😭',
  '🙄', '😳', '🤯', '💪', '👀', '✨',
  '🫶', '🤝', '😊', '🥰', '😘', '🤗',
  '😏', '😒', '🤩', '😤', '😱', '🫡',
  '💀', '🤡', '🙈', '🙊', '❤️‍🔥', '💕',
  '🎯', '⭐', '🌟', '💫', '🏆', '🥇',
];

export default function ChatScreen({ navigation, route }: Props) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState<Array<{ uid: string; name: string; avatar?: string; scope: string }>>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [expandedEmojiMessageId, setExpandedEmojiMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchMessages();
    setupMessageListener();

    return () => {
      cometChatService.removeMessageListener(`chat_${groupId}`);
      cometChatService.removeMessageListener(`reactions_${groupId}`);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [groupId]);

  const isAdminDmChat = groupId.startsWith('adm_');
  const isContactDmChat = groupId.startsWith('contact_');

  const fetchParticipants = async () => {
    setLoadingParticipants(true);
    try {
      if (isAdminDmChat) {
        const dmMatch = groupId.match(/^adm_(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        const bubbleId = dmMatch ? dmMatch[1] : '';
        const memberId = dmMatch ? dmMatch[2] : '';
        try {
          const allMembers = await apiService.getBubbleMembers(bubbleId) as any[];
          const admins = allMembers.filter((m: any) => m.role === 'admin');
          const targetMember = allMembers.find((m: any) => String(m.userId) === memberId);
          const dmParticipants: Array<{ uid: string; name: string; avatar?: string; scope: string }> = [];
          if (targetMember) {
            dmParticipants.push({
              uid: String(targetMember.userId),
              name: targetMember.user?.name || targetMember.user?.email || 'User',
              avatar: targetMember.user?.profilePhoto || undefined,
              scope: 'participant',
            });
          }
          for (const admin of admins) {
            if (!dmParticipants.find(p => p.uid === String(admin.userId))) {
              dmParticipants.push({
                uid: String(admin.userId),
                name: admin.user?.name || admin.user?.email || 'User',
                avatar: admin.user?.profilePhoto || undefined,
                scope: 'admin',
              });
            }
          }
          setParticipants(dmParticipants);
        } catch (dbErr) {
          const ccMembers = await cometChatService.getGroupMembers(groupId);
          setParticipants(ccMembers);
        }
      } else if (isContactDmChat) {
        // contact_<bubbleId>_<userId> — extract the real bubble ID so we don't call
        // /api/bubbles/<full-guid>/members which returns 404
        const contactMatch = groupId.match(
          /^contact_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(.+)$/
        );
        const bubbleId = contactMatch ? contactMatch[1] : '';
        try {
          const allMembers = await apiService.getBubbleMembers(bubbleId) as any[];
          const admins = allMembers.filter((m: any) => m.role === 'admin');
          const contactParticipants: Array<{ uid: string; name: string; avatar?: string; scope: string }> = admins.map((admin: any) => ({
            uid: String(admin.userId),
            name: admin.user?.name || admin.user?.email || 'User',
            avatar: admin.user?.profilePhoto || undefined,
            scope: 'admin',
          }));
          // Non-member enquirer: pull from CometChat group member list and add if not already present
          const ccMembers = await cometChatService.getGroupMembers(groupId);
          for (const ccMember of ccMembers) {
            if (!contactParticipants.find(p => p.uid === ccMember.uid)) {
              contactParticipants.push({ ...ccMember, scope: 'participant' });
            }
          }
          setParticipants(contactParticipants);
        } catch {
          const ccMembers = await cometChatService.getGroupMembers(groupId);
          setParticipants(ccMembers);
        }
      } else {
        const members = await apiService.getBubbleMembers(groupId) as any[];
        const mapped = members.map((m: any) => ({
          uid: String(m.userId),
          name: m.user?.name || m.user?.email || 'User',
          avatar: m.user?.profilePhoto || undefined,
          scope: m.role === 'admin' ? 'admin' : 'participant',
        }));
        setParticipants(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleShowParticipants = () => {
    setShowParticipants(true);
    fetchParticipants();
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const fetchMessages = async () => {
    try {
      if (user) await cometChatService.ensureLoggedIn(user.id, user.name);

      // For DM threads, validate the associated bubble before fetching messages.
      // This provides a clear "Bubble no longer available" message when deep-linking
      // into a stale thread instead of showing a raw CometChat error or crashing.
      //
      // - adm_ threads require approved membership, so we check getMyBubbles().
      // - contact_ threads can be initiated by non-members, so we only check that
      //   the bubble itself still exists (not that the user is an approved member).
      if (isAdminDmChat || isContactDmChat) {
        const prefix = isAdminDmChat ? 'adm_' : 'contact_';
        const rest = groupId.slice(prefix.length);
        const uuidSuffix = rest.match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
        if (uuidSuffix) {
          const bubbleId = rest.slice(0, rest.length - uuidSuffix[0].length);
          try {
            if (isAdminDmChat) {
              const myBubbles = await apiService.getMyBubbles() as any[];
              const isMember = myBubbles.some((b: any) => String(b.id) === String(bubbleId));
              if (!isMember) {
                setChatError('Bubble no longer available. You may have been removed or the bubble was deleted.');
                setIsLoading(false);
                return;
              }
            } else {
              const bubble = await apiService.getBubble(bubbleId);
              if (!bubble) {
                setChatError('Bubble no longer available. This bubble has been deleted.');
                setIsLoading(false);
                return;
              }
            }
          } catch (checkErr: any) {
            if (checkErr?.status === 404 || checkErr?.response?.status === 404) {
              setChatError('Bubble no longer available. This bubble has been deleted.');
              setIsLoading(false);
              return;
            }
            // For other errors (network, etc.), fall through and let CometChat surface any error
          }
        }
      }

      let data = await cometChatService.getMessages(groupId);
      if (data && (data as any).notMember && !isAdminDmChat && !isContactDmChat) {
        // Bubble group: user may have joined the bubble before their CometChat
        // session was established. Lazily create+join the group now.
        try { await cometChatService.createGroup(groupId, groupName || 'Bubble Chat', 'public'); } catch (_) {}
        try { await cometChatService.joinGroup(groupId, 'public'); } catch (_) {}
        data = await cometChatService.getMessages(groupId);
      }
      if (data && (data as any).notMember) {
        setChatError("You're not a member of this group. You may have been removed or your request is still pending.");
        return;
      }
      const formattedMessages = await Promise.all(
        (data as any[])
          .filter((msg: any) => msg.type === 'text' || msg.type === 'image')
          .map(async (msg: any) => {
            const reactions = parseReactions(msg.reactions || {}, user?.id || '');
            const parentMessage = msg.parentMessage ? {
              id: msg.parentMessage.id?.toString(),
              text: msg.parentMessage.text || '',
              senderName: msg.parentMessage.sender?.name || 'Unknown',
            } : undefined;

            return {
              id: msg.id?.toString(),
              text: msg.text || '',
              sentAt: msg.sentAt,
              sender: {
                uid: msg.sender?.uid || '',
                name: msg.sender?.name || 'Unknown',
                avatar: msg.sender?.avatar || undefined,
              },
              reactions,
              parentMessage,
              type: msg.type as 'text' | 'image',
              imageUrl: msg.type === 'image' ? msg.data?.url || msg.url : undefined,
            };
          })
      );
      setMessages(formattedMessages);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      if (error?.code === 'ERR_GUID_NOT_FOUND' || error?.status === 404) {
        setChatError('This chat is no longer available. The group may have been removed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseReactions = (reactionsData: any, currentUserId: string): Reaction[] => {
    if (!reactionsData || typeof reactionsData !== 'object') return [];
    
    const reactions: Reaction[] = [];
    Object.keys(reactionsData).forEach((emoji) => {
      const reactors = reactionsData[emoji] || {};
      const count = Object.keys(reactors).length;
      const reactedByMe = currentUserId in reactors;
      if (count > 0) {
        reactions.push({ emoji, count, reactedByMe });
      }
    });
    return reactions;
  };

  const setupMessageListener = () => {
    const handleNewMessage = (message: any, type: 'text' | 'image') => {
      if (message.receiverId === groupId) {
        const parentMessage = message.parentMessage ? {
          id: message.parentMessage.id?.toString(),
          text: message.parentMessage.text || '',
          senderName: message.parentMessage.sender?.name || 'Unknown',
        } : undefined;

        const newMsg: Message = {
          id: message.id?.toString(),
          text: message.text || '',
          sentAt: message.sentAt,
          sender: {
            uid: message.sender?.uid || '',
            name: message.sender?.name || 'Unknown',
            avatar: message.sender?.avatar || undefined,
          },
          reactions: [],
          parentMessage,
          type,
          imageUrl: type === 'image' ? message.data?.url || message.url : undefined,
        };
        setMessages((prev) => [...prev, newMsg]);
      }
    };

    const listener = cometChatService.getFullMessageListener(
      `chat_${groupId}`,
      (message: any) => handleNewMessage(message, 'text'),
      (message: any) => handleNewMessage(message, 'image')
    );
    cometChatService.addMessageListener(`chat_${groupId}`, listener);

    const reactionListener = cometChatService.getReactionListener(
      `reactions_${groupId}`,
      (reaction: any) => {
        const messageId = reaction.messageId?.toString();
        const emoji = reaction.reaction;
        const reactedByUid = reaction.reactedBy?.uid;
        
        setMessages((prev) => prev.map(m => {
          if (m.id === messageId) {
            const existingReaction = m.reactions.find(r => r.emoji === emoji);
            if (existingReaction) {
              return {
                ...m,
                reactions: m.reactions.map(r => 
                  r.emoji === emoji 
                    ? { ...r, count: r.count + 1, reactedByMe: r.reactedByMe || reactedByUid === user?.id } 
                    : r
                ),
              };
            }
            return {
              ...m,
              reactions: [...m.reactions, { emoji, count: 1, reactedByMe: reactedByUid === user?.id }],
            };
          }
          return m;
        }));
      },
      (reaction: any) => {
        const messageId = reaction.messageId?.toString();
        const emoji = reaction.reaction;
        
        setMessages((prev) => prev.map(m => {
          if (m.id === messageId) {
            return {
              ...m,
              reactions: m.reactions.map(r => {
                if (r.emoji === emoji) {
                  const newCount = r.count - 1;
                  return newCount > 0 ? { ...r, count: newCount } : null;
                }
                return r;
              }).filter(Boolean) as Reaction[],
            };
          }
          return m;
        }));
      }
    );
    cometChatService.addMessageListener(`reactions_${groupId}`, reactionListener);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    const replyTo = replyingTo;
    setIsSending(true);
    setNewMessage('');
    setReplyingTo(null);
    
    try {
      let sentMessage: any;
      if (replyTo) {
        sentMessage = await cometChatService.sendReplyMessage(groupId, messageText, parseInt(replyTo.id));
      } else {
        sentMessage = await cometChatService.sendMessage(groupId, messageText);
      }
      
      const newMsg: Message = {
        id: sentMessage.id?.toString() || Date.now().toString(),
        text: sentMessage.text || messageText,
        sentAt: sentMessage.sentAt || Math.floor(Date.now() / 1000),
        sender: {
          uid: user?.id || '',
          name: user?.name || 'You',
        },
        reactions: [],
        parentMessage: replyTo ? {
          id: replyTo.id,
          text: replyTo.text,
          senderName: replyTo.sender.name,
        } : undefined,
        type: 'text',
      };
      setMessages((prev) => [...prev, newMsg]);

      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      if (error?.code === 'ERR_GUID_NOT_FOUND' || error?.status === 404) {
        setChatError('This chat is no longer available.');
        return;
      }
      if (error?.message?.includes('not a member')) {
        setChatError("You're no longer a member of this group and cannot send messages.");
        return;
      }
      setNewMessage(messageText);
      setReplyingTo(replyTo);
    } finally {
      setIsSending(false);
    }
  };

  const pickImageFromGallery = async () => {
    setShowAttachmentModal(false);
    
    const granted = await requestPhotoLibraryAccess();
    if (!granted) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      await sendImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    setShowAttachmentModal(false);
    
    const granted = await requestCameraAccess();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      await sendImage(result.assets[0]);
    }
  };

  const sendImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploadingImage(true);
    
    try {
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      
      const sentMessage: any = await cometChatService.sendMediaMessage(
        groupId,
        asset.uri,
        fileName,
        mimeType
      );
      
      const newMsg: Message = {
        id: sentMessage.id?.toString() || Date.now().toString(),
        text: '',
        sentAt: sentMessage.sentAt || Math.floor(Date.now() / 1000),
        sender: {
          uid: user?.id || '',
          name: user?.name || 'You',
        },
        reactions: [],
        type: 'image',
        imageUrl: sentMessage.data?.url || sentMessage.url || asset.uri,
      };
      setMessages((prev) => [...prev, newMsg]);

      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send image:', error);
      const msg = error?.message?.includes('not a member')
        ? "You're no longer a member of this group."
        : 'Failed to send image. Please try again.';
      Alert.alert('Image not sent', msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    setShowReactionPicker(null);
    
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions.find(r => r.emoji === emoji);
    
    try {
      if (existingReaction?.reactedByMe) {
        await cometChatService.removeReaction(messageId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            return {
              ...m,
              reactions: m.reactions.map(r => {
                if (r.emoji === emoji) {
                  const newCount = r.count - 1;
                  return newCount > 0 ? { ...r, count: newCount, reactedByMe: false } : null;
                }
                return r;
              }).filter(Boolean) as Reaction[],
            };
          }
          return m;
        }));
      } else {
        await cometChatService.addReaction(messageId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            const existing = m.reactions.find(r => r.emoji === emoji);
            if (existing) {
              return {
                ...m,
                reactions: m.reactions.map(r => 
                  r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
                ),
              };
            }
            return {
              ...m,
              reactions: [...m.reactions, { emoji, count: 1, reactedByMe: true }],
            };
          }
          return m;
        }));
      }
    } catch (error: any) {
      console.error('Failed to toggle reaction:', error);
      Alert.alert('Reaction failed', 'Could not update your reaction. Please try again.');
    }
  };

  const handleLongPress = (messageId: string) => {
    setShowReactionPicker(messageId);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setShowReactionPicker(null);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (senderId: string) => {
    return senderId === user?.id;
  };

  const renderAvatar = (sender: Message['sender']) => {
    if (sender.avatar) {
      return (
        <Image source={{ uri: sender.avatar }} style={styles.avatar} />
      );
    }
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarInitials}>{getInitials(sender.name)}</Text>
      </View>
    );
  };

  const renderReactions = (message: Message) => {
    if (message.reactions.length === 0) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {message.reactions.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            style={[
              styles.reactionBadge,
              reaction.reactedByMe && styles.reactionBadgeActive,
            ]}
            onPress={() => handleReaction(message.id, reaction.emoji)}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderReplyPreview = (parentMessage: Message['parentMessage']) => {
    if (!parentMessage) return null;
    
    const displayText = parentMessage.text || '📷 Photo';
    
    return (
      <View style={styles.replyPreview}>
        <View style={styles.replyBar} />
        <View style={styles.replyContent}>
          <Text style={styles.replySenderName}>{parentMessage.senderName}</Text>
          <Text style={styles.replyText} numberOfLines={1}>{displayText}</Text>
        </View>
      </View>
    );
  };

  const renderImageMessage = (message: Message, isOwn: boolean) => {
    if (!message.imageUrl) return null;
    
    return (
      <TouchableOpacity 
        onPress={() => setFullScreenImage(message.imageUrl!)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: message.imageUrl }}
          style={styles.messageImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  const renderMessage = (message: Message) => {
    const isOwn = isOwnMessage(message.sender.uid);
    
    return (
      <LongPressGestureHandler
        onHandlerStateChange={(e) => {
          if (e.nativeEvent.state === GestureState.ACTIVE) {
            handleLongPress(message.id);
          }
        }}
        minDurationMs={300}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (showReactionPicker && showReactionPicker !== message.id) setShowReactionPicker(null); }}
        >
          <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
            {!isOwn && renderAvatar(message.sender)}
            
            <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
              {!isOwn && (
                <Text style={styles.senderName}>{message.sender.name}</Text>
              )}
              
              {message.parentMessage && renderReplyPreview(message.parentMessage)}
              
              {message.type === 'image' ? (
                <View style={[styles.imageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                  {renderImageMessage(message, isOwn)}
                </View>
              ) : (
                <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                  <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
                    {message.text}
                  </Text>
                </View>
              )}
              
              {renderReactions(message)}
              
              <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                {formatTime(message.sentAt)}
              </Text>
            </View>
          </View>
          
          {showReactionPicker === message.id && (
            <View style={[styles.reactionPickerContainer, isOwn && styles.reactionPickerOwn]}>
              <View style={styles.reactionPicker}>
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionOption}
                    onPress={() => handleReaction(message.id, emoji)}
                  >
                    <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.reactionOption}
                  onPress={() => {
                    setExpandedEmojiMessageId(message.id);
                    setShowReactionPicker(null);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={Colors.neutral.coolMist} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.replyOption}
                  onPress={() => handleReply(message)}
                >
                  <Ionicons name="arrow-undo" size={20} color={Colors.neutral.coolMist} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </LongPressGestureHandler>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlowHeader
        title={groupName}
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={handleShowParticipants} testID="button-participants">
            <PeopleIcon size={22} color={Colors.brand.bubbleBlue} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        {chatError ? (
            <View style={styles.loading}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.neutral.coolMist} />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>{chatError}</Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.brand.bubbleBlue, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderMessage(item)}
              style={styles.messagesList}
              contentContainerStyle={[styles.messagesContent, messages.length === 0 && { flex: 1, justifyContent: 'center' }]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onScrollBeginDrag={() => showReactionPicker && setShowReactionPicker(null)}
              ListEmptyComponent={
                <Pressable style={styles.emptyMessages} onPress={() => setShowReactionPicker(null)}>
                  <Text style={styles.emptyText}>No messages yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to say hello!</Text>
                </Pressable>
              }
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
            />
          )}

        {replyingTo && (
          <View style={styles.replyingToBar}>
            <View style={styles.replyingToContent}>
              <Text style={styles.replyingToLabel}>Replying to {replyingTo.sender.name}</Text>
              <Text style={styles.replyingToText} numberOfLines={1}>
                {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelReply}>
              <Ionicons name="close" size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttachmentModal(true)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} />
            ) : (
              <Ionicons name="add-circle" size={28} color={Colors.brand.bubbleBlue} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            placeholderTextColor={Colors.neutral.coolMist}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.brand.skyWhite} />
            ) : (
              <Ionicons name="send" size={20} color={Colors.brand.skyWhite} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showAttachmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAttachmentModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.attachmentModal}>
                <Text style={styles.attachmentModalTitle}>Share</Text>
                <View style={styles.attachmentOptions}>
                  <TouchableOpacity style={styles.attachmentOption} onPress={takePhoto}>
                    <View style={[styles.attachmentIcon, { backgroundColor: Colors.state.success }]}>
                      <Ionicons name="camera" size={24} color={Colors.brand.skyWhite} />
                    </View>
                    <Text style={styles.attachmentLabel}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentOption} onPress={pickImageFromGallery}>
                    <View style={[styles.attachmentIcon, { backgroundColor: '#9C27B0' }]}>
                      <Ionicons name="images" size={24} color={Colors.brand.skyWhite} />
                    </View>
                    <Text style={styles.attachmentLabel}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={28} color={Colors.brand.skyWhite} />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showParticipants}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParticipants(false)}
      >
        <View style={styles.participantsOverlay}>
          <View style={styles.participantsContainer}>
            <View style={styles.participantsHeader}>
              <Text style={styles.participantsTitle}>Participants</Text>
              <TouchableOpacity onPress={() => setShowParticipants(false)}>
                <Ionicons name="close" size={24} color={Colors.neutral.charcoal} />
              </TouchableOpacity>
            </View>
            {loadingParticipants ? (
              <View style={styles.participantsLoading}>
                <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
              </View>
            ) : (
              <ScrollView style={styles.participantsList}>
                {participants.map((p) => (
                  <View key={p.uid} style={styles.participantRow}>
                    {p.avatar ? (
                      <Image source={{ uri: p.avatar }} style={styles.participantAvatar} />
                    ) : (
                      <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
                        <Text style={styles.participantInitials}>{getInitials(p.name)}</Text>
                      </View>
                    )}
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{p.name}</Text>
                      {p.scope === 'admin' && (
                        <Text style={styles.participantRole}>Admin</Text>
                      )}
                      {p.scope === 'owner' && (
                        <Text style={styles.participantRole}>Owner</Text>
                      )}
                    </View>
                    {p.uid === user?.id && (
                      <Text style={styles.participantYou}>You</Text>
                    )}
                  </View>
                ))}
                {participants.length === 0 && (
                  <Text style={styles.noParticipants}>No participants found</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={expandedEmojiMessageId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setExpandedEmojiMessageId(null)}
      >
        <TouchableWithoutFeedback onPress={() => setExpandedEmojiMessageId(null)}>
          <View style={styles.expandedEmojiOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.expandedEmojiContainer}>
                <View style={styles.expandedEmojiHeader}>
                  <Text style={styles.expandedEmojiTitle}>Pick a Reaction</Text>
                  <TouchableOpacity onPress={() => setExpandedEmojiMessageId(null)}>
                    <Ionicons name="close" size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.expandedEmojiGrid}>
                  {EXPANDED_EMOJIS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.expandedEmojiOption}
                      onPress={() => {
                        if (expandedEmojiMessageId) {
                          handleReaction(expandedEmojiMessageId, emoji);
                        }
                        setExpandedEmojiMessageId(null);
                      }}
                    >
                      <Text style={styles.expandedEmojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginTop: 4,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: Colors.brand.skyWhite,
    fontSize: 12,
    fontWeight: '600',
  },
  messageContainer: {
    maxWidth: '75%',
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  ownBubble: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: Colors.brand.skyWhite,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: Colors.brand.skyWhite,
  },
  otherText: {
    color: Colors.neutral.charcoal,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.neutral.coolMist,
    marginTop: 4,
    marginLeft: 4,
  },
  messageTimeOwn: {
    marginRight: 4,
    marginLeft: 0,
  },
  replyPreview: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  replyBar: {
    width: 3,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  replyContent: {
    flex: 1,
    padding: 8,
  },
  replySenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  replyText: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },
  reactionBadgeActive: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: 'hsl(210, 95%, 97%)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginLeft: 4,
  },
  reactionPickerContainer: {
    marginBottom: 8,
    marginLeft: 40,
  },
  reactionPickerOwn: {
    marginLeft: 0,
    marginRight: 0,
    alignItems: 'flex-end',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 24,
    padding: 8,
    ...CardShadow,
  },
  reactionOption: {
    padding: 8,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
  replyOption: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.neutral.coolMist,
    marginLeft: 4,
    paddingLeft: 12,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.skyWhite,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.coolMist,
  },
  replyingToContent: {
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.bubbleBlue,
    paddingLeft: 10,
  },
  replyingToLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  replyingToText: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  cancelReply: {
    padding: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: Colors.brand.skyWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.coolMist,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 16,
    fontSize: 16,
    maxHeight: 100,
    color: Colors.neutral.charcoal,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.bubbleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  imageBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 4,
  },
  messageImage: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachmentModal: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 20,
  },
  attachmentOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  attachmentOption: {
    alignItems: 'center',
  },
  attachmentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: Colors.neutral.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  participantsButton: {
    padding: 8,
    marginLeft: 8,
  },
  participantsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  participantsContainer: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  participantsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
  },
  participantsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  participantsList: {
    padding: 16,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral.coolMist,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  participantAvatarPlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.skyWhite,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  participantRole: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
    marginTop: 2,
  },
  participantYou: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    fontWeight: '500',
  },
  noParticipants: {
    textAlign: 'center',
    color: Colors.neutral.coolMist,
    fontSize: 14,
    padding: 20,
  },
  expandedEmojiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  expandedEmojiContainer: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  expandedEmojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.cloudGrey,
  },
  expandedEmojiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  expandedEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    justifyContent: 'flex-start',
  },
  expandedEmojiOption: {
    width: '16.66%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedEmojiText: {
    fontSize: 30,
  },
});
