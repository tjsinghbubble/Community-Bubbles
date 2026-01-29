import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';

type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { groupId: string; groupName: string };
};

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'Chat'>;
  route: RouteProp<MessagesStackParamList, 'Chat'>;
};

type Message = {
  id: string;
  text: string;
  sentAt: number;
  sender: {
    uid: string;
    name: string;
  };
};

export default function ChatScreen({ navigation, route }: Props) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchMessages();
    setupMessageListener();

    return () => {
      cometChatService.removeMessageListener(`chat_${groupId}`);
    };
  }, [groupId]);

  const fetchMessages = async () => {
    try {
      const data = await cometChatService.getMessages(groupId);
      const formattedMessages = (data as any[])
        .filter((msg: any) => msg.type === 'text')
        .map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          sentAt: msg.sentAt,
          sender: {
            uid: msg.sender?.uid || '',
            name: msg.sender?.name || 'Unknown',
          },
        }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupMessageListener = () => {
    const listener = cometChatService.getMessageListener(
      `chat_${groupId}`,
      (message: any) => {
        if (message.receiverId === groupId) {
          const newMsg: Message = {
            id: message.id,
            text: message.text,
            sentAt: message.sentAt,
            sender: {
              uid: message.sender?.uid || '',
              name: message.sender?.name || 'Unknown',
            },
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      }
    );
    cometChatService.addMessageListener(`chat_${groupId}`, listener);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setIsSending(true);
    setNewMessage('');
    
    try {
      const sentMessage = await cometChatService.sendMessage(groupId, messageText) as any;
      
      const newMsg: Message = {
        id: sentMessage.id || Date.now().toString(),
        text: sentMessage.text || messageText,
        sentAt: sentMessage.sentAt || Math.floor(Date.now() / 1000),
        sender: {
          uid: user?.id || '',
          name: user?.name || 'You',
        },
      };
      setMessages((prev) => [...prev, newMsg]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (senderId: string) => {
    return senderId === user?.id;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
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
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageContainer,
                    isOwnMessage(message.sender.uid) ? styles.ownMessage : styles.otherMessage,
                  ]}
                >
                  {!isOwnMessage(message.sender.uid) && (
                    <Text style={styles.senderName}>{message.sender.name}</Text>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isOwnMessage(message.sender.uid) ? styles.ownBubble : styles.otherBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isOwnMessage(message.sender.uid) ? styles.ownText : styles.otherText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                  <Text style={styles.messageTime}>{formatTime(message.sentAt)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
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
              <Text style={styles.sendButtonText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  backText: {
    fontSize: 24,
    color: 'hsl(210, 95%, 55%)',
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
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: 'hsl(210, 95%, 55%)',
  },
  otherBubble: {
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
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
    fontSize: 15,
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});
