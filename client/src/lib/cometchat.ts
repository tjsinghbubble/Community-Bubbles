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

  async getConversations() {
    const req = new CometChat.ConversationsRequestBuilder()
      .setLimit(50)
      .setConversationType("group")
      .build();
    return req.fetchNext();
  }

  async getMessages(guid: string, limit = 50) {
    const req = new CometChat.MessagesRequestBuilder()
      .setGUID(guid)
      .setLimit(limit)
      .build();
    return req.fetchPrevious();
  }

  async sendMessage(guid: string, text: string) {
    const msg = new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP);
    return CometChat.sendMessage(msg);
  }

  addMessageListener(listenerId: string, listener: CometChat.MessageListener) {
    CometChat.addMessageListener(listenerId, listener);
  }

  removeMessageListener(listenerId: string) {
    CometChat.removeMessageListener(listenerId);
  }
}

export const webCometChat = new WebCometChatService();
