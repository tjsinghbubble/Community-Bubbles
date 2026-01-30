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
      
      const group = await CometChat.joinGroup(guid, type);
      console.log('Joined group:', group);
      return group;
    } catch (error: any) {
      // Handle already a member case gracefully
      if (error?.code === 'ERR_ALREADY_JOINED') {
        console.log('Already a member of group:', guid);
        return await CometChat.getGroup(guid);
      }
      console.error('Failed to join group:', error);
      throw error;
    }
  }

  async leaveGroup(guid: string) {
    try {
      await CometChat.leaveGroup(guid);
      console.log('Left group:', guid);
    } catch (error) {
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
}

export default new CometChatService();
