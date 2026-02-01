import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';

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
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchMessages();
    setupMessageListener();

    return () => {
      cometChatService.removeMessageListener(`chat_${groupId}`);
      cometChatService.removeMessageListener(`reactions_${groupId}`);
    };
  }, [groupId]);

  const fetchMessages = async () => {
    try {
      const data = await cometChatService.getMessages(groupId);
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
    } catch (error) {
      console.error('Failed to fetch messages:', error);
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
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
      setReplyingTo(replyTo);
    } finally {
      setIsSending(false);
    }
  };

  const pickImageFromGallery = async () => {
    setShowAttachmentModal(false);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('Media library permission denied');
      return;
    }
    
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
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.log('Camera permission denied');
      return;
    }

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
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send image:', error);
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
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
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

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
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
      <TouchableOpacity
        key={message.id}
        onLongPress={() => handleLongPress(message.id)}
        delayLongPress={300}
        activeOpacity={0.9}
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
                style={styles.replyOption}
                onPress={() => handleReply(message)}
              >
                <Ionicons name="arrow-undo" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="hsl(210, 95%, 55%)" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={() => setShowReactionPicker(null)}>
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyMessages}>
                  <Text style={styles.emptyText}>No messages yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to say hello!</Text>
                </View>
              ) : (
                messages.map(renderMessage)
              )}
            </ScrollView>
          )}
        </TouchableWithoutFeedback>

        {replyingTo && (
          <View style={styles.replyingToBar}>
            <View style={styles.replyingToContent}>
              <Text style={styles.replyingToLabel}>Replying to {replyingTo.sender.name}</Text>
              <Text style={styles.replyingToText} numberOfLines={1}>
                {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelReply}>
              <Ionicons name="close" size={20} color="#666" />
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
              <ActivityIndicator size="small" color="hsl(210, 95%, 55%)" />
            ) : (
              <Ionicons name="add-circle" size={28} color="hsl(210, 95%, 55%)" />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            placeholderTextColor="#999"
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
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
                    <View style={[styles.attachmentIcon, { backgroundColor: '#4CAF50' }]}>
                      <Ionicons name="camera" size={24} color="#fff" />
                    </View>
                    <Text style={styles.attachmentLabel}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentOption} onPress={pickImageFromGallery}>
                    <View style={[styles.attachmentIcon, { backgroundColor: '#9C27B0' }]}>
                      <Ionicons name="images" size={24} color="#fff" />
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
            <Ionicons name="close" size={28} color="#fff" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    color: '#000',
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
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
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
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#fff',
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
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#888',
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
    backgroundColor: 'hsl(210, 95%, 55%)',
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
    color: '#666',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  reactionBadgeActive: {
    borderColor: 'hsl(210, 95%, 55%)',
    backgroundColor: 'hsl(210, 95%, 97%)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
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
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
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
    borderLeftColor: '#eee',
    marginLeft: 4,
    paddingLeft: 12,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  replyingToContent: {
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: 'hsl(210, 95%, 55%)',
    paddingLeft: 10,
  },
  replyingToLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  replyingToText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cancelReply: {
    padding: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 16,
    fontSize: 16,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    color: '#666',
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: '#000',
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
});
