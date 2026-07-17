import Dexie, { type Table } from 'dexie';
import type { Chat } from '../types/chat';
import type { Message } from '../types/message';

// We extend Message to include chatId for local indexing
export interface LocalMessage extends Message {
  chatId: number;
  syncStatus?: 'synced' | 'pending' | 'failed'; // For offline sync support
}

export class ChatDatabase extends Dexie {
  chats!: Table<Chat, number>;
  messages!: Table<LocalMessage, number>;

  constructor() {
    super('ChatDatabase');
    this.version(1).stores({
      chats: 'id, lastMessageTime',
      messages: 'id, chatId, created_at, syncStatus'
    });
  }
}

export const localDb = new ChatDatabase();

// Helper functions for easy access
export const saveChatsLocally = async (chats: Chat[]) => {
  await localDb.chats.bulkPut(chats);
};

export const getLocalChats = async () => {
  return await localDb.chats.orderBy('lastMessageTime').reverse().toArray();
};

export const saveMessagesLocally = async (chatId: number, messages: Message[]) => {
  const localMessages = messages.map(msg => ({
    ...msg,
    chatId,
    syncStatus: 'synced' as const
  }));
  await localDb.messages.bulkPut(localMessages);
};

export const getLocalMessages = async (chatId: number) => {
  return await localDb.messages
    .where('chatId')
    .equals(chatId)
    .sortBy('created_at'); 
};

export const saveSingleMessageLocally = async (chatId: number, message: Message, syncStatus: 'synced' | 'pending' = 'synced') => {
  const localMsg: LocalMessage = {
    ...message,
    chatId,
    syncStatus
  };
  await localDb.messages.put(localMsg);
  return localMsg;
};

export const clearLocalDb = async () => {
  await localDb.chats.clear();
  await localDb.messages.clear();
};
