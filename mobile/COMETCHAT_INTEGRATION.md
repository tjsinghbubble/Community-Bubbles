# CometChat Integration Guide

This guide explains how CometChat is integrated into the Bubble mobile app and how to extend it.

## Overview

CometChat provides the real-time messaging infrastructure for Bubble. Each bubble has its own group chat where members can communicate in real-time.

## Current Integration Status

### ✅ Already Implemented

1. **CometChat Service** (`src/services/cometchat.service.ts`)
   - Initialize CometChat SDK
   - Login/logout users
   - Create groups
   - Join/leave groups
   - Send/receive messages

2. **Auto-Integration with Auth**
   - User is automatically logged into CometChat after signup
   - CometChat user ID matches backend user ID
   - User profile synced (name, etc.)

3. **Environment Configuration**
   - Credentials in `.env` file
   - Constants in `src/constants/cometchat.ts`

## How It Works

### 1. App Launch
```typescript
// In App.tsx
useEffect(() => {
  cometChatService.initialize();
}, []);
```

### 2. User Signup/Login
```typescript
// After successful auth
const authResponse = await apiService.signup(data);
await cometChatService.loginUser(authResponse.user.id, authResponse.user.name);
```

### 3. Bubble Creation (To Implement)
```typescript
// When creating a bubble
const bubble = await apiService.createBubble(bubbleData);
await cometChatService.createGroup(bubble.id, bubble.title);
```

### 4. Joining a Bubble (To Implement)
```typescript
// When user joins a bubble
await apiService.joinBubble(bubbleId);
await cometChatService.joinGroup(bubbleId);
```

### 5. Chat Screen (To Implement)
```typescript
// In chat screen
const messages = await cometChatService.fetchMessages(bubbleId);
await cometChatService.sendMessage(bubbleId, messageText);
```

## CometChat Setup

### 1. Create CometChat Account
1. Go to [CometChat Dashboard](https://www.cometchat.com/dashboard)
2. Sign up for free account
3. Create a new app

### 2. Get Credentials
From your CometChat dashboard:
- **App ID**: Found in app settings
- **Region**: us, eu, or in (based on your selection)
- **Auth Key**: Found in API Keys section

### 3. Add to Environment
In `mobile/.env`:
```env
COMETCHAT_APP_ID=your_app_id_here
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key_here
```

## Building the Chat Screen

### Option 1: Custom Chat UI (Current Approach)

You have complete control over the UI:

```typescript
import { cometChatService } from '../services/cometchat.service';

export function ChatScreen({ route }) {
  const { bubbleId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  // Load messages
  useEffect(() => {
    loadMessages();
  }, [bubbleId]);

  const loadMessages = async () => {
    const msgs = await cometChatService.fetchMessages(bubbleId);
    setMessages(msgs);
  };

  const sendMessage = async () => {
    if (inputText.trim()) {
      await cometChatService.sendMessage(bubbleId, inputText);
      setInputText('');
      loadMessages();
    }
  };

  return (
    <View>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble message={item} />
        )}
      />
      <TextInput
        value={inputText}
        onChangeText={setInputText}
        placeholder="Type a message..."
      />
      <Button title="Send" onPress={sendMessage} />
    </View>
  );
}
```

### Option 2: CometChat UI Kit (Fastest)

Install pre-built UI components:

```bash
npm install @cometchat/chat-uikit-react-native
```

Then use ready-made components:

```typescript
import { CometChatMessages } from '@cometchat/chat-uikit-react-native';

export function ChatScreen({ route }) {
  const { bubbleId } = route.params;

  return (
    <CometChatMessages
      group={bubbleId}
      // Customize styling to match your brand
    />
  );
}
```

## API Reference

### CometChatService Methods

#### `initialize(): Promise<void>`
Initialize the CometChat SDK. Call once on app launch.

#### `loginUser(userId: string, userName: string): Promise<void>`
Login a user to CometChat. Call after successful authentication.

#### `logoutUser(): Promise<void>`
Logout the current user from CometChat.

#### `createGroup(groupId: string, groupName: string): Promise<void>`
Create a new group chat for a bubble.

```typescript
await cometChatService.createGroup('bubble-123', 'Photography Enthusiasts');
```

#### `joinGroup(groupId: string): Promise<void>`
Join an existing group.

```typescript
await cometChatService.joinGroup('bubble-123');
```

#### `leaveGroup(groupId: string): Promise<void>`
Leave a group.

```typescript
await cometChatService.leaveGroup('bubble-123');
```

#### `sendMessage(groupId: string, messageText: string): Promise<void>`
Send a text message to a group.

```typescript
await cometChatService.sendMessage('bubble-123', 'Hello everyone!');
```

#### `fetchMessages(groupId: string, limit?: number): Promise<any[]>`
Fetch recent messages from a group.

```typescript
const messages = await cometChatService.fetchMessages('bubble-123', 50);
```

## Real-Time Message Listening

For live updates when messages arrive:

```typescript
import { CometChat } from '@cometchat/chat-sdk-react-native';

// In your chat screen
useEffect(() => {
  const listenerID = 'BUBBLE_CHAT_LISTENER';
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTextMessageReceived: (message) => {
        // Update UI with new message
        setMessages(prev => [...prev, message]);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
  };
}, []);
```

## Integration Checklist

### For Each Bubble Feature:

- [ ] **Create Bubble**
  - Call `cometChatService.createGroup(bubbleId, bubbleName)`
  - Group ID should match bubble ID from backend
  - Creator auto-joins the group

- [ ] **Join Bubble**
  - Call `cometChatService.joinGroup(bubbleId)`
  - After successful backend join API call
  - Handle already-member case gracefully

- [ ] **Leave Bubble**
  - Call `cometChatService.leaveGroup(bubbleId)`
  - After successful backend leave API call
  - Clean up any local chat data

- [ ] **Delete Bubble** (Future)
  - Delete the CometChat group
  - Remove all members first
  - Clean up chat history

## Best Practices

### 1. Sync Backend & CometChat
Always keep backend and CometChat in sync:

```typescript
async function joinBubble(bubbleId: string) {
  try {
    // Step 1: Join in backend
    await apiService.joinBubble(bubbleId);
    
    // Step 2: Join in CometChat
    await cometChatService.joinGroup(bubbleId);
  } catch (error) {
    // Handle errors - rollback if needed
  }
}
```

### 2. Error Handling
Handle CometChat errors gracefully:

```typescript
try {
  await cometChatService.sendMessage(groupId, text);
} catch (error) {
  if (error.code === 'ERR_NOT_A_MEMBER') {
    Alert.alert('Error', 'You are not a member of this group');
  }
}
```

### 3. Offline Support
CometChat handles offline/online automatically, but you should:
- Show connection status to users
- Queue messages when offline
- Sync when reconnected

### 4. Performance
- Limit message fetch (default 50 messages)
- Implement pagination for message history
- Use FlatList with proper optimization for message lists

## Troubleshooting

### CometChat won't initialize
```
Error: Invalid App ID
```
**Solution**: Check `COMETCHAT_APP_ID` in `.env` matches dashboard

### User can't login to CometChat
```
Error: User does not exist
```
**Solution**: User must be created in CometChat first. Use `cometChatService.loginUser()` which auto-creates users.

### Can't send messages
```
Error: Not a member
```
**Solution**: Call `joinGroup()` before sending messages

### Messages not updating in real-time
**Solution**: Implement `CometChat.addMessageListener()` for live updates

## Resources

- [CometChat React Native SDK Docs](https://www.cometchat.com/docs/react-native-chat-sdk/overview)
- [CometChat UI Kit](https://www.cometchat.com/docs/react-native-ui-kit/overview)
- [CometChat Dashboard](https://www.cometchat.com/dashboard)
- [Sample Apps](https://github.com/cometchat/react-native-chat-sdk)

## Next Steps

1. **Build Chat Screen**
   - Create `src/screens/main/ChatScreen.tsx`
   - Use `fetchMessages()` and `sendMessage()`
   - Add to navigation stack

2. **Test Real-Time Messaging**
   - Install on 2 devices
   - Join same bubble
   - Send messages back and forth

3. **Add Rich Features**
   - Image/video messages
   - Voice messages
   - Typing indicators
   - Read receipts
   - Message reactions

---

CometChat is fully integrated and ready to use! All the infrastructure is set up - you just need to build the UI screens. 🚀
