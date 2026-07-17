import Dexie, { type Table } from 'dexie';
import type { Chat } from '../types/chat';
import type { Message } from '../types/message';

// We extend Message to include chatId for local indexing
export interface LocalMessage extends Message {
  chatId: number;
  syncStatus?: 'synced' | 'pending' | 'failed'; // For offline sync support
}

export interface KeyStore {
  id: string; // "myPrivateKey"
  privateKey: CryptoKey;
}

// Outbox stores the encrypted ciphertexts for pending messages so they can be
// retried exactly as-is when connectivity is restored (we can't re-encrypt at retry time).
export interface OutboxEntry {
  id: number;           // Matches the tempId of the pending LocalMessage
  chatId: number;
  encryptedContent: string;   // Ciphertext for recipient
  senderContent?: string;     // Ciphertext for self
  plaintext: string;          // Plaintext to store locally after successful send
  created_at: string;
}

export class ChatDatabase extends Dexie {
  chats!: Table<Chat, number>;
  messages!: Table<LocalMessage, number>;
  keys!: Table<KeyStore, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super('ChatDatabase');
    this.version(2).stores({
      chats: 'id, lastMessageTime',
      messages: 'id, chatId, created_at, syncStatus',
      keys: 'id'
    });
    this.version(3).stores({
      chats: 'id, lastMessageTime',
      messages: 'id, chatId, created_at, syncStatus',
      keys: 'id',
      outbox: 'id, chatId'
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

export const deleteMessageLocally = async (messageId: number) => {
  await localDb.messages.delete(messageId);
};

// Outbox helpers for offline message queue
export const addToOutbox = async (entry: OutboxEntry) => {
  await localDb.outbox.put(entry);
};

export const getOutboxForChat = async (chatId: number): Promise<OutboxEntry[]> => {
  return await localDb.outbox.where('chatId').equals(chatId).toArray();
};

export const removeFromOutbox = async (id: number) => {
  await localDb.outbox.delete(id);
};

export const clearLocalDb = async () => {
  await localDb.chats.clear();
  await localDb.messages.clear();
  // We generally DO NOT clear keys on logout to preserve access if they log back in
};

export const getMyPrivateKey = async (userId: number): Promise<CryptoKey | undefined> => {
  const keyEntry = await localDb.keys.get(`privateKey_${userId}`);
  if (keyEntry) {
    return keyEntry.privateKey;
  }

  // Fallback: migrate old un-scoped key
  const oldKeyEntry = await localDb.keys.get("myPrivateKey");
  if (oldKeyEntry) {
    await localDb.keys.put({ id: `privateKey_${userId}`, privateKey: oldKeyEntry.privateKey });
    await localDb.keys.delete("myPrivateKey");
    return oldKeyEntry.privateKey;
  }
  return undefined;
};

export const saveMyPrivateKey = async (userId: number, privateKey: CryptoKey) => {
  await localDb.keys.put({ id: `privateKey_${userId}`, privateKey });
};
