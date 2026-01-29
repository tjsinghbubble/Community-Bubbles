export type Interest = {
  id: string;
  label: string;
  emoji: string;
};

export type Bubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  description: string;
  rules: string[];
  privacy: 'Public' | 'Private';
  coverImage?: string;
  members: number;
  distance?: string;
  creatorId: string;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  interests: string[];
  createdAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  bubbleId: string;
  joinedAt: string;
};

export type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  receiverId: string;
  receiverType: 'group' | 'user';
};
