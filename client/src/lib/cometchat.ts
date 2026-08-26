import { CometChat } from "@cometchat/chat-sdk-javascript";

const APP_ID = "1673948f1ffba3646";
const REGION = "us";

class WebCometChatService {
  private initialized = false;

  async init() {
    if (this.initialized) return;
    const appSetting = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .autoEstablishSocketConnection(true)
      .build();
    await CometChat.init(APP_ID, appSetting);
    this.initialized = true;
  }

  async getLoggedInUser() {
    return CometChat.getLoggedinUser();
  }

  async loginWithToken(authToken: string) {
    const existing = await CometChat.getLoggedinUser();
    if (existing) return existing;
    return CometChat.login(authToken);
  }

  async logout() {
    try { await CometChat.logout(); } catch (_) {}
  }

  /** All chats — group bubbles/events and 1:1 "peer_" DMs alike — are CometChat groups. */
  async getConversations() {
    const req = new CometChat.ConversationsRequestBuilder()
      .setLimit(50)
      .setConversationType("group")
      .build();
    return req.fetchNext();
  }

  async getMessages(guid: string, limit = 50) {
    try {
      const builder = new CometChat.MessagesRequestBuilder().setGUID(guid).setLimit(limit);
      return await builder.build().fetchPrevious();
    } catch (error: any) {
      if (error?.code === "ERR_GROUP_NOT_JOINED") return [];
      throw error;
    }
  }

  async sendMessage(guid: string, text: string) {
    const msg = new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP);
    return CometChat.sendMessage(msg);
  }

  async sendMediaMessage(guid: string, file: File) {
    const mediaMessage = new CometChat.MediaMessage(
      guid,
      file,
      CometChat.MESSAGE_TYPE.IMAGE,
      CometChat.RECEIVER_TYPE.GROUP,
    );
    return CometChat.sendMediaMessage(mediaMessage);
  }

  async editMessage(guid: string, messageId: string, text: string) {
    const message = new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP);
    message.setId(Number(messageId));
    return CometChat.editMessage(message);
  }

  async deleteMessage(messageId: string) {
    return CometChat.deleteMessage(messageId);
  }

  async addReaction(messageId: string, emoji: string) {
    return CometChat.addReaction(Number(messageId), emoji);
  }

  async removeReaction(messageId: string, emoji: string) {
    return CometChat.removeReaction(Number(messageId), emoji);
  }

  async createGroup(guid: string, name: string, type: "public" | "private" = "public") {
    const groupType = type === "private" ? CometChat.GROUP_TYPE.PRIVATE : CometChat.GROUP_TYPE.PUBLIC;
    try {
      const group = new CometChat.Group(guid, name, groupType);
      return await CometChat.createGroup(group);
    } catch (error: any) {
      if (error?.code === "ERR_GUID_ALREADY_EXISTS") {
        return await CometChat.getGroup(guid);
      }
      throw error;
    }
  }

  async joinGroup(guid: string, type: "public" | "private" = "public") {
    const groupType = type === "private" ? CometChat.GROUP_TYPE.PRIVATE : CometChat.GROUP_TYPE.PUBLIC;
    try {
      return await CometChat.joinGroup(guid, groupType as any);
    } catch (error: any) {
      if (error?.code === "ERR_ALREADY_JOINED") {
        return await CometChat.getGroup(guid);
      }
      if (error?.code === "ERR_GROUP_JOIN_NOT_ALLOWED") return null;
      throw error;
    }
  }

  async addMembersToGroup(guid: string, members: Array<{ uid: string; name: string; scope?: string }>) {
    try {
      const groupMembers = members.map((m) => {
        const member = new CometChat.GroupMember(
          m.uid,
          m.scope === "admin" ? CometChat.GROUP_MEMBER_SCOPE.ADMIN : CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT,
        );
        member.setName(m.name);
        return member;
      });
      if (groupMembers.length > 0) {
        await CometChat.addMembersToGroup(guid, groupMembers, []);
      }
    } catch (error) {
      console.log("Add members to group error (may be partial):", error);
    }
  }

  async getGroupMembers(guid: string) {
    try {
      const req = new CometChat.GroupMembersRequestBuilder(guid).setLimit(100).build();
      const members = await req.fetchNext();
      return members.map((m: any) => ({
        uid: m.getUid(),
        name: m.getName(),
        avatar: m.getAvatar() || undefined,
        scope: m.getScope(),
      }));
    } catch (error) {
      console.error("Failed to fetch group members:", error);
      return [];
    }
  }

  addMessageListener(listenerId: string, listener: CometChat.MessageListener) {
    CometChat.addMessageListener(listenerId, listener);
  }

  removeMessageListener(listenerId: string) {
    CometChat.removeMessageListener(listenerId);
  }
}

export const webCometChat = new WebCometChatService();
