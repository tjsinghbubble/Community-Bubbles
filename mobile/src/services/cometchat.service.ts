import { COMETCHAT_CONSTANTS } from '../constants/cometchat';
import apiService from './api.service';

// Lazy SDK reference — the heavy CometChat SDK is NOT imported at module load
// time. It is required on first use so it doesn't crash the JS runtime during
// app startup (the SDK's crypto dependency fails on iOS before the runtime is
// fully warmed up).
let _sdk: any = null;
function cc(): any {
  if (!_sdk) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sdk = require('@cometchat/chat-sdk-react-native').CometChat;
  }
  return _sdk;
}

class CometChatService {
  private initialized = false;
  private loggedIn = false;
  private _conversationsRequest: any = null;

  /** True only after the user has explicitly logged into CometChat (i.e. opened messaging). */
  get isReady(): boolean {
    return this.loggedIn;
  }

  async init() {
    if (this.initialized) return;

    const CometChat = cc();
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
    const CometChat = cc();
    try {
      const existing = await CometChat.getLoggedinUser();
      if (existing && existing.getUid() !== uid) {
        try { await CometChat.logout(); } catch (_) {}
      } else if (existing && existing.getUid() === uid) {
        console.log('CometChat: already logged in as', uid);
        return existing;
      }

      const { authToken } = await apiService.getCometChatAuthToken();
      const user = await CometChat.login(authToken);
      console.log('Login successful:', user);
      return user;
    } catch (error: any) {
      if (error?.code === 'ERR_ALREADY_LOGGED_IN') {
        console.log('CometChat: already logged in, skipping');
        return await CometChat.getLoggedinUser();
      }
      console.error('Login failed:', error);
      throw error;
    }
  }

  async getGroupMembers(guid: string): Promise<Array<{ uid: string; name: string; avatar?: string; scope: string }>> {
    const CometChat = cc();
    try {
      const groupMemberRequest = new CometChat.GroupMembersRequestBuilder(guid)
        .setLimit(100)
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

  async ensureLoggedIn(userId: number | string, userName: string): Promise<void> {
    try {
      if (!this.initialized) await this.init();
      const CometChat = cc();
      const existing = await CometChat.getLoggedinUser();
      if (existing) {
        this.loggedIn = true;
        return;
      }
      await this.loginUser(String(userId), userName);
      this.loggedIn = true;
    } catch (error) {
      console.log('CometChat ensureLoggedIn error:', error);
    }
  }

  async logoutUser() {
    const CometChat = cc();
    try {
      await CometChat.logout();
      this.loggedIn = false;
      console.log('Logout successful');
    } catch (error: any) {
      if (error?.code === 'USER_NOT_LOGED_IN') {
        this.loggedIn = false;
        return;
      }
      console.error('Logout failed:', error);
    }
  }

  async createGroup(guid: string, name: string, type: string = 'public') {
    const CometChat = cc();
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
    const CometChat = cc();
    try {
      const type = groupType === 'private'
        ? CometChat.GROUP_TYPE.PRIVATE
        : CometChat.GROUP_TYPE.PUBLIC;
      const group = await CometChat.joinGroup(guid, type);
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
    const CometChat = cc();
    try {
      const groupMembers = members.map(m => {
        const member = new CometChat.GroupMember(
          m.uid,
          m.scope === 'admin' ? CometChat.GROUP_MEMBER_SCOPE.ADMIN : CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT,
        );
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

  async createContactGroup(guid: string, name: string, memberUids: string[]) {
    const CometChat = cc();
    let group: any;
    try {
      const newGroup = new CometChat.Group(guid, name, CometChat.GROUP_TYPE.PRIVATE);
      group = await CometChat.createGroup(newGroup);
    } catch (error: any) {
      if (error?.code === 'ERR_GUID_ALREADY_EXISTS') {
        group = await CometChat.getGroup(guid);
      } else {
        throw error;
      }
    }

    try {
      await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PRIVATE);
    } catch (e: any) {
      if (e?.code !== 'ERR_ALREADY_JOINED' && e?.code !== 'ERR_GROUP_JOIN_NOT_ALLOWED') {
        console.log('joinGroup in createContactGroup:', e?.code);
      }
    }

    if (memberUids.length > 0) {
      const groupMembers = memberUids.map(uid =>
        new CometChat.GroupMember(uid, CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT),
      );
      try {
        await CometChat.addMembersToGroup(guid, groupMembers, []);
      } catch (e: any) {
        console.log('addMembersToGroup in createContactGroup (may be partial):', e?.code || e?.message);
      }
    }

    return group;
  }

  async leaveGroup(guid: string) {
    const CometChat = cc();
    try {
      await CometChat.leaveGroup(guid);
      console.log('Left group:', guid);
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED' || error?.code === 'ERR_GUID_NOT_FOUND') {
        console.log('User was not in CometChat group:', guid);
        return;
      }
      console.error('Failed to leave group:', error);
      throw error;
    }
  }

  async sendMessage(guid: string, text: string) {
    const CometChat = cc();
    try {
      const textMessage = new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP);
      const message = await CometChat.sendMessage(textMessage);
      console.log('Message sent successfully:', message);
      return message;
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED') {
        throw new Error('You are not a member of this group and cannot send messages.');
      }
      console.error('Message sending failed:', error);
      throw error;
    }
  }

  async sendDirectMessage(uid: string, text: string) {
    const CometChat = cc();
    try {
      const textMessage = new CometChat.TextMessage(uid, text, CometChat.RECEIVER_TYPE.USER);
      const message = await CometChat.sendMessage(textMessage);
      console.log('Direct message sent successfully:', message);
      return message;
    } catch (error) {
      console.error('Direct message sending failed:', error);
      throw error;
    }
  }

  getMessageListener(listenerID: string, onNewMessage: (message: any) => void) {
    const CometChat = cc();
    return new CometChat.MessageListener({
      onTextMessageReceived: (message: any) => { onNewMessage(message); },
    });
  }

  addMessageListener(listenerID: string, listener: any) {
    cc().addMessageListener(listenerID, listener);
  }

  removeMessageListener(listenerID: string) {
    cc().removeMessageListener(listenerID);
  }

  buildConversationsRequest(limit: number = 30) {
    const CometChat = cc();
    this._conversationsRequest = new CometChat.ConversationsRequestBuilder()
      .setLimit(limit)
      .setConversationType('group')
      .build();
  }

  async fetchConversationsPage(): Promise<{ conversations: any[]; hasMore: boolean }> {
    if (!this._conversationsRequest) this.buildConversationsRequest();
    try {
      const page = await this._conversationsRequest!.fetchNext();
      return { conversations: page, hasMore: page.length > 0 };
    } catch (error) {
      console.error('Failed to fetch conversations page:', error);
      throw error;
    }
  }

  async getTotalUnreadCount(): Promise<number> {
    const CometChat = cc();
    try {
      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) return 0;
      const conversations = await new CometChat.ConversationsRequestBuilder()
        .setLimit(50)
        .setConversationType('group')
        .build()
        .fetchNext();
      return conversations.reduce((total: number, conv: any) => total + ((conv as any).unreadMessageCount || 0), 0);
    } catch (error: any) {
      if (error?.code === 'USER_NOT_LOGED_IN') return 0;
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  async getPermissionFilteredUnreadCount(approvedBubbleIds: Set<string>): Promise<number> {
    const CometChat = cc();
    try {
      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) return 0;
      const conversations = await new CometChat.ConversationsRequestBuilder()
        .setLimit(50)
        .setConversationType('group')
        .build()
        .fetchNext();
      let total = 0;
      for (const conv of conversations) {
        const guid: string = (conv as any).conversationWith?.guid || '';
        const isDm = guid.startsWith('contact_') || guid.startsWith('adm_') || guid.startsWith('peer_');
        if (!isDm && !approvedBubbleIds.has(guid)) continue;
        total += (conv as any).unreadMessageCount || 0;
      }
      return total;
    } catch (error: any) {
      if (error?.code === 'USER_NOT_LOGED_IN') return 0;
      console.error('Failed to get filtered unread count:', error);
      return 0;
    }
  }

  async getAdmConversationCountForBubble(bubbleId: string): Promise<number> {
    const CometChat = cc();
    try {
      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) return 0;
      const conversations = await new CometChat.ConversationsRequestBuilder()
        .setLimit(50)
        .setConversationType('group')
        .build()
        .fetchNext();
      const prefix = `adm_${bubbleId}_`;
      return conversations.filter((conv: any) => {
        const guid: string = conv.conversationWith?.guid || '';
        return guid.startsWith(prefix);
      }).length;
    } catch {
      return 0;
    }
  }

  async getMessages(guid: string, limit: number = 50) {
    const CometChat = cc();
    try {
      const messages = await new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setLimit(limit)
        .build()
        .fetchPrevious();
      return messages;
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED') {
        return { notMember: true, messages: [] };
      }
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  }

  async addReaction(messageId: string | number, emoji: string) {
    const CometChat = cc();
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
    const CometChat = cc();
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
    const CometChat = cc();
    try {
      const reactions = await new CometChat.ReactionsRequestBuilder()
        .setMessageId(parseInt(messageId))
        .setLimit(100)
        .build()
        .fetchNext();
      return reactions;
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
      return [];
    }
  }

  async sendReplyMessage(guid: string, text: string, parentMessageId: number) {
    const CometChat = cc();
    try {
      const textMessage = new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP);
      textMessage.setParentMessageId(parentMessageId);
      const message = await CometChat.sendMessage(textMessage);
      console.log('Reply message sent successfully:', message);
      return message;
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED') {
        throw new Error('You are not a member of this group and cannot send messages.');
      }
      console.error('Reply message sending failed:', error);
      throw error;
    }
  }

  getReactionListener(
    listenerID: string,
    onReactionAdded: (reaction: any) => void,
    onReactionRemoved: (reaction: any) => void,
  ) {
    const CometChat = cc();
    return new CometChat.MessageListener({
      onTextMessageReceived: () => {},
      onMessageReactionAdded: (reaction: any) => { onReactionAdded(reaction); },
      onMessageReactionRemoved: (reaction: any) => { onReactionRemoved(reaction); },
    });
  }

  async sendMediaMessage(guid: string, fileUri: string, fileName: string, mimeType: string) {
    const CometChat = cc();
    try {
      const mediaMessage = new CometChat.MediaMessage(
        guid,
        { uri: fileUri, name: fileName, type: mimeType },
        CometChat.MESSAGE_TYPE.IMAGE,
        CometChat.RECEIVER_TYPE.GROUP,
      );
      const message = await CometChat.sendMediaMessage(mediaMessage);
      console.log('Media message sent successfully:', message);
      return message;
    } catch (error: any) {
      if (error?.code === 'ERR_GROUP_NOT_JOINED') {
        throw new Error('You are not a member of this group and cannot send images.');
      }
      console.error('Media message sending failed:', error);
      throw error;
    }
  }

  async markAsRead(guid: string, lastMessageId: string, lastMessageSenderUid: string): Promise<void> {
    const CometChat = cc();
    try {
      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) return;
      const numericId = parseInt(lastMessageId, 10);
      if (isNaN(numericId)) return;
      await CometChat.markAsRead(numericId, guid, CometChat.RECEIVER_TYPE.GROUP, lastMessageSenderUid);
    } catch (error) {
      console.log('markAsRead error (non-critical):', error);
    }
  }

  getFullMessageListener(
    listenerID: string,
    onTextMessage: (message: any) => void,
    onMediaMessage: (message: any) => void,
  ) {
    const CometChat = cc();
    return new CometChat.MessageListener({
      onTextMessageReceived: (message: any) => { onTextMessage(message); },
      onMediaMessageReceived: (message: any) => { onMediaMessage(message); },
    });
  }

  async getPeerUser(uid: string): Promise<{ status: 'online' | 'offline'; lastActiveAt: number | null }> {
    const CometChat = cc();
    try {
      const user = await CometChat.getUser(uid);
      const status = (user as any).getStatus?.() === 'online' ? 'online' : 'offline';
      const lastActiveAt = (user as any).getLastActiveAt?.() ?? null;
      return { status, lastActiveAt };
    } catch (error) {
      console.log('getPeerUser error (non-critical):', error);
      return { status: 'offline', lastActiveAt: null };
    }
  }

  addUserPresenceListener(
    listenerID: string,
    onUserOnline: (user: any) => void,
    onUserOffline: (user: any) => void,
  ) {
    const CometChat = cc();
    const listener = new CometChat.UserListener({
      onUserOnline: (user: any) => onUserOnline(user),
      onUserOffline: (user: any) => onUserOffline(user),
    });
    CometChat.addUserListener(listenerID, listener);
  }

  removeUserPresenceListener(listenerID: string) {
    cc().removeUserListener(listenerID);
  }
}

export default new CometChatService();
