export interface TranslationMessage {
  original: string;
  translation: string;
  userId: string;
  userName: string;
  oriLang: string;
  targetLang: string;
  timestamp: number;
}

export interface UserInfo {
  id: string;
  name: string;
  roomId: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface RoomInfo {
  id: string;
  users: Set<string>;
  lastActivity: number;
  createdAt: number;
}

export interface SystemMessage {
  type: 'user_join' | 'user_leave' | 'heartbeat' | 'room_status';
  roomId: string;
  data: any;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
