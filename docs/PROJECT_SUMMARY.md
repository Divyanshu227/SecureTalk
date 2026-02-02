# Chat Application - Complete Implementation Guide

## Project Overview
A full-stack real-time chat application built with React (TypeScript), Node.js, Express, and PostgreSQL.

## Features Implemented

### ✅ Authentication
- **Register**: Create new user accounts with name, email, and password
- **Login**: Authenticate users with JWT tokens
- **Protected Routes**: Chat pages require authentication
- **Session Management**: Token stored in localStorage with automatic attachment to API requests

### ✅ Chat Management
- **View Chats**: See all active conversations with users
- **Create Chats**: Start new conversations with any registered user
- **Duplicate Prevention**: Automatically reuses existing chats between the same users
- **Chat List**: Displays user names and last message preview
- **Active Chat Highlighting**: Visual feedback for selected conversation

### ✅ Messaging Features
- **Send Messages**: Real-time message sending with Enter key support
- **View Messages**: Chronological message display with timestamps
- **Edit Messages**: Update sent messages with visual "(edited)" indicator
- **Delete Messages**: Remove messages permanently
- **Message Actions**: Edit/Delete buttons appear on hover for your messages
- **Message Ownership**: Only message authors can edit/delete

### ✅ UI/UX Design
- **Modern Styling**: Gradient backgrounds, smooth animations, responsive layout
- **Dark/Light Colors**: Purple gradient theme with readable text
- **Modal Dialogs**: Clean dialogs for editing messages and creating chats
- **Responsive Design**: Mobile-friendly layout that adapts to screen size
- **User Feedback**: Loading states, error messages, success notifications
- **Smooth Animations**: Fade-in effects for messages and transitions

### ✅ Component Architecture
- **AuthContext**: Global authentication state management
- **ProtectedRoute**: Route-level authentication protection
- **Login Page**: Styled form with error handling
- **Register Page**: User registration with success feedback
- **Chat Page**: Main chat interface with sidebar
- **ChatList**: Dynamic list of conversations
- **ChatWindow**: Message display and input area

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user (returns JWT)
- `GET /auth/me` - Get current user info (requires auth)
- `GET /auth/users` - Get all other users (requires auth)

### Chat Management
- `GET /chats` - Fetch user's chats (requires auth)
- `POST /chats` - Create new chat (requires auth)

### Messages
- `POST /chats/:chatId/messages` - Send message (requires auth)
- `GET /chats/:chatId/messages` - Fetch messages (requires auth)
- `PUT /chats/:chatId/messages/:messageId` - Edit message (requires auth)
- `DELETE /chats/:chatId/messages/:messageId` - Delete message (requires auth)

## Database Schema

### Users Table
```sql
id (PRIMARY KEY)
name (VARCHAR)
email (VARCHAR, UNIQUE)
password (VARCHAR)
created_at (TIMESTAMP)
```

### Chats Table
```sql
id (PRIMARY KEY)
created_at (TIMESTAMP)
```

### Chat Members Table
```sql
id (PRIMARY KEY)
chat_id (FOREIGN KEY)
user_id (FOREIGN KEY)
joined_at (TIMESTAMP)
```

### Messages Table
```sql
id (PRIMARY KEY)
chat_id (FOREIGN KEY)
sender_id (FOREIGN KEY)
content (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

## How to Run

### Backend Setup
```bash
cd Backend
npm install
npm run dev
```
Server runs on `http://localhost:5000`

### Frontend Setup
```bash
cd chat-frontend
npm install
npm run dev
```
Application runs on `http://localhost:5173` (or next available port)

## Key Technologies

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Axios** for HTTP requests
- **React Router** for navigation
- **Custom CSS** with gradients and animations

### Backend
- **Node.js** with Express.js
- **PostgreSQL** for data persistence
- **JWT** for authentication
- **bcrypt** for password hashing
- **CORS** for cross-origin requests

## Security Features
- Password hashing with bcrypt
- JWT token authentication
- Authorization checks on message edit/delete
- Protected routes preventing unauthorized access
- CORS enabled for frontend-backend communication

## User Workflow

1. **Register/Login**
   - User creates account or logs in with credentials
   - JWT token is obtained and stored
   - User is redirected to chat interface

2. **Start New Chat**
   - Click "+ New Chat" button
   - Select user from list
   - Chat opens (creates if new, reuses if exists)

3. **Send Messages**
   - Type message in input field
   - Press Enter or click Send
   - Message appears with timestamp

4. **Manage Messages**
   - Hover over your message to see Edit/Delete
   - Click Edit to modify message
   - Click Delete to remove message
   - See "(edited)" indicator on modified messages

5. **Logout**
   - Click Logout button
   - Session clears, redirected to login

## Styling Highlights

### Color Scheme
- Primary Gradient: Purple (#667eea to #764ba2)
- Background: Light Gray (#f5f5f5)
- Text: Dark Gray (#333)
- Borders: Light Gray (#e0e0e0)

### Interactive Elements
- Hover effects with subtle transitions
- Active states with color changes
- Modal overlays with semi-transparent backdrop
- Smooth animations for messages

### Layout
- Fixed sidebar for chat list
- Flexible main area for chat window
- Sticky header with user info
- Fixed input area at bottom
- Scrollable message area

## Error Handling
- Network error messages for failed operations
- Validation feedback on forms
- User-friendly error descriptions
- Automatic token removal on auth failure

## Future Enhancement Ideas
- Real-time socket.io integration
- Message search functionality
- User typing indicators
- Message read receipts
- Group chats
- File/image sharing
- User online status
- Message reactions/emojis
- Chat notifications
- User profile pages
