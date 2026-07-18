# Chat Application - Complete Implementation Guide

## Project Overview
A full-stack real-time, offline-first chat application built with React (TypeScript), Node.js, Express, and PostgreSQL, featuring End-to-End Encryption (E2EE) and cross-device sync.

## Features Implemented

### ✅ Authentication & Security
- **Register**: Create new user accounts with secure password hashing (bcrypt).
- **Login**: Authenticate users with JWT tokens.
- **End-to-End Encryption (E2EE)**: Messages are encrypted locally using RSA-OAEP before leaving the device. Keys are synced securely using AES-GCM.
- **Protected Routes**: Chat pages require authentication.
- **Session Management**: Tokens stored and automatically attached to requests.

### ✅ Chat Management
- **View Chats**: See all active conversations with users in real-time.
- **Create Chats**: Start new conversations with any registered user.
- **Duplicate Prevention**: Automatically reuses existing chats between the same users.
- **Chat List**: Displays user names and last message preview.

### ✅ Messaging Features
- **Send Messages**: Real-time message sending with Socket.io.
- **Offline Message Queuing**: Messages are stored locally in IndexedDB (Dexie.js) and synced automatically when back online.
- **Message Status & Read Receipts**: Real-time updates for Sent, Delivered, and Read ticks.
- **Edit & Delete**: Modify or remove sent messages permanently.
- **Media Sharing**: Securely share images, videos, audio, and documents (hybrid AES-RSA encryption) utilizing Cloudinary for blob storage.
- **Push Notifications**: Receive Web Push notifications for new messages.

### ✅ UI/UX Design
- **Modern Styling**: Gradient backgrounds, smooth animations, responsive layout.
- **PWA Ready**: Installable Progressive Web App for desktop and mobile.
- **Visual Feedback**: Real-time notification sounds, error messages, success notifications.

## Database Schema

### Users Table
```sql
id (PRIMARY KEY)
name (VARCHAR)
email (VARCHAR, UNIQUE)
password (VARCHAR)
created_at (TIMESTAMP)
public_key (TEXT)
encrypted_private_key (TEXT)
username (VARCHAR, UNIQUE)
require_connection (BOOLEAN)
last_seen (TIMESTAMP)
```

### Chat Table
```sql
chatid (PRIMARY KEY)
userid1 (FOREIGN KEY)
userid2 (FOREIGN KEY)
```

### Messages Table
```sql
messageid (PRIMARY KEY)
chatid (FOREIGN KEY)
senderid (FOREIGN KEY)
receiverid (FOREIGN KEY)
content (TEXT)
created_at (TIMESTAMP)
sender_content (TEXT)
status (VARCHAR)
```

### Connections & Push Tables
```sql
connections (user1, user2 PRIMARY KEY)
connection_requests (id PRIMARY KEY)
push_subscriptions (id PRIMARY KEY)
```

## How to Run

### Backend Setup
```bash
cd Backend
npm install
# Create .env with DATABASE_URL, JWT_SECRET, and CLOUDINARY credentials
npm run dev
```
Server runs on `http://localhost:5000`

### Frontend Setup
```bash
cd chat-frontend
npm install
npm run dev
```
Application runs on `http://localhost:5173`

## Key Technologies

### Frontend
- **React 18 (TypeScript)** & **Vite**
- **Dexie.js** for Local-first IndexedDB persistence
- **WebCrypto API** for E2EE (RSA-OAEP, AES-GCM, PBKDF2)
- **Socket.io-client** for real-time events

### Backend
- **Node.js** with **Express.js**
- **PostgreSQL** for data persistence
- **Socket.io** for real-time WebSocket communication
- **Cloudinary** for media storage
- **web-push** for Push Notifications

## Future Enhancement Ideas
- Message search functionality
- Group chats
- User profile pages
- Message reactions/emojis
