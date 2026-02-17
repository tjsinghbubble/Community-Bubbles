import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import cometChatService from '../../services/cometchat.service';
import apiService from '../../services/api.service';
import { MessagesStackParamList } from '../../navigation/MessagesNavigator';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type Conversation = {
  conversationId: string;
  conversationType: string;
  conversationWith: {
    guid: string;
    name: string;
    membersCount: number;
    icon?: string;
  };
  lastMessage?: {
    text?: string;
    sentAt: number;
    sender?: {
      name: string;
    };
  };
  unreadMessageCount: number;
};

type Props = {
  navigation: NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;
  route: RouteProp<MessagesStackParamList, 'MessagesList'>;
};

export default function MessagesScreen({ navigation, route }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bubbleImages, setBubbleImages] = useState<Record<string, string | null>>({});
  const hasAutoNavigated = React.useRef(false);

  const fetchBubbleImages = async (convs: Conversation[]) => {
    const imageMap: Record<string, string | null> = {};
    const fetchPromises = convs.map(async (conv) => {
      const guid = conv.conversationWith.guid;
      if (conv.conversationWith.icon) {
        imageMap[guid] = conv.conversationWith.icon;
        return;
      }
      try {
        const bubble = await apiService.getBubble(guid) as any;
        if (bubble?.coverImage) {
          imageMap[guid] = bubble.coverImage;
        } else if (bubble?.images?.length > 0) {
          imageMap[guid] = bubble.images[0];
        } else {
          imageMap[guid] = null;
        }
      } catch {
        imageMap[guid] = null;
      }
    });
    await Promise.all(fetchPromises);
    setBubbleImages(imageMap);
  };

  const fetchConversations = async () => {
    try {
      const data = await cometChatService.getConversations();
      const convs = data as unknown as Conversation[];
      setConversations(convs);
      fetchBubbleImages(convs);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    const openGroupId = route.params?.openGroupId;
    const openGroupName = route.params?.openGroupName;
    if (openGroupId && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      navigation.navigate('Chat', {
        groupId: openGroupId,
        groupName: openGroupName || 'Admin Chat',
      });
    }
  }, [route.params?.openGroupId, route.params?.openGroupName]);

  useFocusEffect(
    useCallback(() => {
      hasAutoNavigated.current = false;
      fetchConversations();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('Chat', {
      groupId: conversation.conversationWith.guid,
      groupName: conversation.conversationWith.name,
    });
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderAvatar = (conversation: Conversation) => {
    const guid = conversation.conversationWith.guid;
    const imageUrl = bubbleImages[guid] || conversation.conversationWith.icon;

    if (imageUrl) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={styles.avatarImage}
        />
      );
    }

    return (
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {conversation.conversationWith.name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  if (conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Join some bubbles to start chatting with your community!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.conversationId}
            style={styles.conversationItem}
            onPress={() => handleConversationPress(conversation)}
          >
            {renderAvatar(conversation)}
            
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {conversation.conversationWith.name}
                </Text>
                {conversation.lastMessage?.sentAt && (
                  <Text style={styles.time}>
                    {formatTime(conversation.lastMessage.sentAt)}
                  </Text>
                )}
              </View>
              
              <View style={styles.conversationFooter}>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {conversation.lastMessage?.text 
                    ? `${conversation.lastMessage.sender?.name || 'Someone'}: ${conversation.lastMessage.text}`
                    : 'No messages yet'}
                </Text>
                {conversation.unreadMessageCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {conversation.unreadMessageCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.brand.bubbleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: Colors.neutral.coolMist,
  },
  avatarText: {
    color: Colors.brand.skyWhite,
    fontSize: 20,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: Colors.brand.skyWhite,
    fontSize: 12,
    fontWeight: '600',
  },
});
