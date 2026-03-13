import { CometChat } from '@cometchat/chat-sdk-react-native';
import { COMETCHAT_CONSTANTS } from '../constants/cometchat';

class CometChatService {
  private initialized = false;

  async init() {
    if (this.initialized) return;

    const appSetting = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(COMETCHAT_CONSTANTS.REGION)
      .autoEstablishSocketConnection(true)
      .build();

    try {
      await CometChat.init(COMETCHAT_CONSTANTS.APP_ID, appSetting);
      this.initialized = true;
      console.log('CometChat initialized successfully');
    } catch (error) {
      console.error('CometChat initialization failed:', error);
      throw error;
    }
  }

  async loginUser(uid: string, name: string) {
    try {
      await this.createUserIfNotExists(uid, name);
      
      const user = await CometChat.login(uid, COMETCHAT_CONSTANTS.AUTH_KEY);
      console.log('Login successful:', user);
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async createUserIfNotExists(uid: string, name: string) {
    try {
      const user = new CometChat.User(uid);
      user.setName(name);
      
      await CometChat.createUser(user, COMETCHAT_CONSTANTS.AUTH_KEY);
      console.log('User created:', uid);
    } catch (error: any) {
      if (error?.code !== 'ERR_UID_ALREADY_EXISTS') {
        throw error;
      }
    }
  }

  async getGroupMembers(guid: string): Promise<Array<{ uid: string; name: string; avatar?: string; scope: string }>> {
    try {
      const limit = 100;
      const groupMemberRequest = new CometChat.GroupMembersRequestBuilder(guid)
        .setLimit(limit)
        .build();
      const members = await groupMemberRequest.fetchNext();
      return members.map((m: any) => ({
        uid: m.getUid(),
        name: m.getName(),
        avatar: m.getAvatar() || undefined,
        scope: m.getScope(),
      }));
    } catch (error) {
      console.error('Failed to fetch group members:', error);
      return [];
    }
  }

  async logoutUser() {
    try {
      await CometChat.logout();
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  async createGroup(guid: string, name: string, type: string = 'public') {
    try {
      const groupType = type === 'private' 
        ? CometChat.GROUP_TYPE.PRIVATE 
        : CometChat.GROUP_TYPE.PUBLIC;
      
      const group = new CometChat.Group(guid, name, groupType);
      const createdGroup = await CometChat.createGroup(group);
      console.log('Group created:', createdGroup);
      return createdGroup;
    } catch (error: any) {
      if (error?.code === 'ERR_GUID_ALREADY_EXISTS') {
        return await CometChat.getGroup(guid);
      }
      throw error;
    }
  }

  async joinGroup(guid: string, groupType: string = 'public') {
    try {
      const type = groupType === 'private' 
        ? CometChat.GROUP_TYPE.PRIVATE 
        : CometChat.GROUP_TYPE.PUBLIC;
      
      const group = await CometChat.joinGroup(guid, type as CometChat.GroupType);
      console.log('Joined group:', group);
      return group;
    } catch (error: any) {
      if (error?.code === 'ERR_ALREADY_JOINED') {
        console.log('Already a member of group:', guid);
        return await CometChat.getGroup(guid);
      }
      if (error?.code === 'ERR_GROUP_JOIN_NOT_ALLOWED') {
        console.log('Join group note:', error?.code);
        return null;
      }
      console.error('Failed to join group:', error);
      throw error;
    }
  }

  async addMembersToGroup(guid: string, members: Array<{ uid: string; name: string; scope?: string }>) {
    try {
      const groupMembers = members.map(m => {
        const member = new CometChat.GroupMember(m.uid, m.scope === 'admin' ? CometChat.GROUP_MEMBER_SCOPE.ADMIN : CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT);
        member.setName(m.name);
        return member;
      });
      if (groupMembers.length > 0) {
        await CometChat.addMembersToGroup(guid, groupMembers, []);
        console.log(`Added ${groupMembers.length} members to group ${guid}`);
      }
    } catch (error: any) {
      console.log('Add members to group error (may be partial):', error?.code || error?.message);
    }
  }

  async leaveGroup(guid: string) {
    try {
      await CometChat.leaveGroup(guid);
      console.log('Left group:', guid);
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED') {
        console.log('User was not in CometChat group (already left):', guid);
        return;
      }
      console.error('Failed to leave group:', error);
      throw error;
    }
  }

  async sendMessage(guid: string, text: string) {
    try {
      const receiverID = guid;
      const messageText = text;
      const receiverType = CometChat.RECEIVER_TYPE.GROUP;
      const textMessage = new CometChat.TextMessage(
        receiverID,
        messageText,
        receiverType
      );
      
      const message = await CometChat.sendMessage(textMessage);
      console.log('Message sent successfully:', message);
      return message;
    } catch (error) {
      console.error('Message sending failed:', error);
      throw error;
    }
  }

  async sendDirectMessage(uid: string, text: string) {
    try {
      const textMessage = new CometChat.TextMessage(
        uid,
        text,
        CometChat.RECEIVER_TYPE.USER
      );
      const message = await CometChat.sendMessage(textMessage);
      console.log('Direct message sent successfully:', message);
      return message;
    } catch (error) {
      console.error('Direct message sending failed:', error);
      throw error;
    }
  }

  getMessageListener(listenerID: string, onNewMessage: (message: any) => void) {
    return new CometChat.MessageListener({
      onTextMessageReceived: (message: any) => {
        onNewMessage(message);
      },
    });
  }

  addMessageListener(listenerID: string, listener: any) {
    CometChat.addMessageListener(listenerID, listener);
  }

  removeMessageListener(listenerID: string) {
    CometChat.removeMessageListener(listenerID);
  }

  async getConversations() {
    try {
      const conversationsRequest = new CometChat.ConversationsRequestBuilder()
        .setLimit(30)
        .setConversationType('group')
        .build();
      
      const conversations = await conversationsRequest.fetchNext();
      console.log('Fetched conversations:', conversations.length);
      return conversations;
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      throw error;
    }
  }

  async getTotalUnreadCount(): Promise<number> {
    try {
      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) {
        return 0;
      }
      const conversationsRequest = new CometChat.ConversationsRequestBuilder()
        .setLimit(50)
        .setConversationType('group')
        .build();
      const conversations = await conversationsRequest.fetchNext();
      let total = 0;
      for (const conv of conversations) {
        const count = (conv as any).unreadMessageCount || 0;
        total += count;
      }
      return total;
    } catch (error: any) {
      if (error?.code === 'USER_NOT_LOGED_IN') {
        return 0;
      }
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  async getMessages(guid: string, limit: number = 50) {
    try {
      const messagesRequest = new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setLimit(limit)
        .build();
      
      const messages = await messagesRequest.fetchPrevious();
      return messages;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  }

  async addReaction(messageId: string | number, emoji: string) {
    try {
      const numericId = typeof messageId === 'string' ? parseInt(messageId) : messageId;
      await CometChat.addReaction(numericId, emoji);
      console.log('Reaction added:', emoji);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      throw error;
    }
  }

  async removeReaction(messageId: string | number, emoji: string) {
    try {
      const numericId = typeof messageId === 'string' ? parseInt(messageId) : messageId;
      await CometChat.removeReaction(numericId, emoji);
      console.log('Reaction removed:', emoji);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      throw error;
    }
  }

  async getMessageReactions(messageId: string) {
    try {
      const request = new CometChat.ReactionsRequestBuilder()
        .setMessageId(parseInt(messageId))
        .setLimit(100)
        .build();
      const reactions = await request.fetchNext();
      return reactions;
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
      return [];
    }
  }

  async sendReplyMessage(guid: string, text: string, parentMessageId: number) {
    try {
      const receiverID = guid;
      const messageText = text;
      const receiverType = CometChat.RECEIVER_TYPE.GROUP;
      const textMessage = new CometChat.TextMessage(
        receiverID,
        messageText,
        receiverType
      );
      textMessage.setParentMessageId(parentMessageId);
      
      const message = await CometChat.sendMessage(textMessage);
      console.log('Reply message sent successfully:', message);
      return message;
    } catch (error) {
      console.error('Reply message sending failed:', error);
      throw error;
    }
  }

  getReactionListener(listenerID: string, onReactionAdded: (reaction: any) => void, onReactionRemoved: (reaction: any) => void) {
    return new CometChat.MessageListener({
      onTextMessageReceived: () => {},
      onMessageReactionAdded: (reaction: any) => {
        onReactionAdded(reaction);
      },
      onMessageReactionRemoved: (reaction: any) => {
        onReactionRemoved(reaction);
      },
    });
  }

  async sendMediaMessage(guid: string, fileUri: string, fileName: string, mimeType: string) {
    try {
      const receiverID = guid;
      const receiverType = CometChat.RECEIVER_TYPE.GROUP;
      
      const file = {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      };
      
      const mediaMessage = new CometChat.MediaMessage(
        receiverID,
        file,
        CometChat.MESSAGE_TYPE.IMAGE,
        receiverType
      );
      
      const message = await CometChat.sendMediaMessage(mediaMessage);
      console.log('Media message sent successfully:', message);
      return message;
    } catch (error) {
      console.error('Media message sending failed:', error);
      throw error;
    }
  }

  getFullMessageListener(
    listenerID: string, 
    onTextMessage: (message: any) => void,
    onMediaMessage: (message: any) => void
  ) {
    return new CometChat.MessageListener({
      onTextMessageReceived: (message: any) => {
        onTextMessage(message);
      },
      onMediaMessageReceived: (message: any) => {
        onMediaMessage(message);
      },
    });
  }
}

export default new CometChatService();
