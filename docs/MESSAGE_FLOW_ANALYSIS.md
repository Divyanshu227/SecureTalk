# SecureTalk - Project Analysis & Message Flow Documentation

## 📋 Project Overview

**SecureTalk** is a full-stack real-time chat application with the following core components:

- **Frontend**: React 18 + TypeScript with Vite
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Real-time Communication**: Socket.IO
- **Authentication**: JWT + Bcrypt

---

## 🎯 Core Requirements

### 1. **Authentication System**
- User registration with name, email, and password
- User login with JWT token generation
- Token-based API authentication via Bearer token
- Password hashing with bcrypt
- Protected routes (only authenticated users can access chats)
- Auto-logout on token expiry or missing auth

### 2. **Chat Management**
- Users can create new conversations with other registered users
- View all active chats in a sidebar
- Duplicate chat prevention (reuse existing chat if one already exists between two users)
- Display last message preview and other user's info
- Chat persistence across sessions

### 3. **Messaging System**
- Send messages in real-time
- View message history in chronological order
- Edit sent messages (only by the message author)
- Delete messages (only by the message author)
- Display timestamps and "(edited)" indicator
- Real-time message delivery via Socket.IO

### 4. **UI/UX Features**
- Modern gradient design (purple theme #667eea → #764ba2)
- Responsive layout (mobile, tablet, desktop)
- Smooth animations and transitions
- Modal dialogs for editing messages and creating chats
- Loading states and error messages
- User-friendly message display with timestamps

---

## 🔄 Complete Message Flow

### **Flow 1: User Registration**
```
User enters credentials in Register.tsx
      ↓
POST /auth/register → authController.register()
      ↓
Validate email uniqueness
      ↓
Hash password with bcrypt (10 rounds)
      ↓
INSERT into users table
      ↓
Return success message
      ↓
Auto-redirect to Login page
```

### **Flow 2: User Login**
```
User enters email/password in Login.tsx
      ↓
POST /auth/login → authController.login()
      ↓
Query database for user by email
      ↓
Compare password with bcrypt.compare()
      ↓
If valid: Generate JWT token (1 day expiry)
      ↓
Return token to frontend
      ↓
Store token in localStorage
      ↓
Redirect to Chat page
      ↓
Initialize Socket.IO connection with token
```

### **Flow 3: Fetch Current User**
```
Frontend (AuthContext) calls GET /auth/me
      ↓
authMiddleware validates JWT token
      ↓
Extract user.id from decoded JWT
      ↓
Query database for user info (id, name, email)
      ↓
Return user data to frontend
      ↓
Store in AuthContext state
```

### **Flow 4: Fetch All Users**
```
User clicks "New Chat" button
      ↓
GET /auth/users → authController.getAllUsers()
      ↓
authMiddleware validates token
      ↓
Query all users except current user
      ↓
Return user list to frontend
      ↓
Display in chat creation modal
```

### **Flow 5: Create/Get Chat**
```
User selects another user to chat with
      ↓
POST /chats with { otherUserId }
      ↓
authMiddleware validates token
      ↓
chatController.createChat() checks for existing chat:
   - Query: Find chat with BOTH user IDs in chat_members
   - If exists: Return existing chatId
   - If not exists:
        ↓
     INSERT new chat
        ↓
     INSERT 2 chat_members rows (current user + other user)
        ↓
     Return new chatId
      ↓
Frontend navigates to chat window with chatId
```

### **Flow 6: Load Chat List**
```
User navigates to Chat page
      ↓
GET /chats → chatController.getChats()
      ↓
authMiddleware validates token
      ↓
Query all chats for current user with:
   - Chat ID
   - Other user info (id, name, email)
   - Last message preview
   - Ordered by most recent message first
      ↓
Return chat list to frontend
      ↓
Display in ChatList.tsx sidebar
```

### **Flow 7: Load Messages (History)**
```
User clicks on a chat in sidebar
      ↓
ChatWindow component mounts with selected chat
      ↓
GET /chats/:chatId/messages
      ↓
authMiddleware validates token
      ↓
messageController.getMessages() queries:
   - SELECT messages WHERE chat_id = chatId
   - ORDER BY created_at ASC
      ↓
Return all messages with:
   - id, senderId, content, created_at
      ↓
Frontend receives messages and renders them
      ↓
Messages displayed chronologically
      ↓
Auto-scroll to bottom
```

### **Flow 8: Send Message (Hybrid - Socket + REST)**
```
User types message and presses Enter or clicks Send
      ↓
Frontend: Emit message via Socket.IO
   socket.emit("send_message", { chatId, content })
      ↓
Backend chatSocket.js receives event:
   - Validate chatId and content
   - INSERT into messages table
   - io.to(chatId).emit("receive_message", { chatId, senderId, content })
      ↓
ALL users in chat receive message via Socket.IO
      ↓
Frontend ALSO sends via REST API (for persistence guarantee):
   POST /chats/:chatId/messages
      ↓
messageController.sendMessage() inserts message
      ↓
Return full message object with database ID
      ↓
Frontend updates message with correct ID and timestamp
      ↓
Message displayed in ChatWindow
```

**Why Hybrid Approach?**
- Socket.IO: Real-time delivery to other users in the chat room
- REST API: Ensures message is saved with unique ID and timestamp
- Frontend deduplication: Prevents duplicate messages from appearing

### **Flow 9: Edit Message**
```
User hovers over their message and clicks "Edit"
      ↓
Modal dialog opens with current message text
      ↓
User edits text and presses Enter or clicks "Save"
      ↓
Frontend calls:
   PUT /chats/:chatId/messages/:messageId
   { content: "updated text" }
      ↓
authMiddleware validates token
      ↓
messageController.editMessage():
   - Query message by ID and chatId
   - Verify sender_id === req.user.id (ownership check)
   - If not owner: Return 403 Unauthorized
   - UPDATE messages SET content = new content
   - Return updated message
      ↓
Frontend updates message in state
      ↓
Message re-renders with updated content
      ↓
Modal closes
```

### **Flow 10: Delete Message**
```
User hovers over their message and clicks "Delete"
      ↓
Frontend calls:
   DELETE /chats/:chatId/messages/:messageId
      ↓
authMiddleware validates token
      ↓
messageController.deleteMessage():
   - Query message by ID and chatId
   - Verify sender_id === req.user.id (ownership check)
   - If not owner: Return 403 Unauthorized
   - DELETE message from database
   - Return success message
      ↓
Frontend removes message from state
      ↓
Message disappears from ChatWindow
```

### **Flow 11: Socket.IO Connection Lifecycle**
```
User logs in successfully
      ↓
Token stored in localStorage
      ↓
Chat page loads, SocketProvider initializes
      ↓
Frontend connects Socket.IO with:
   - auth: { token: JWT_TOKEN }
   - transports: ["websocket", "polling"]
   - reconnection: true
   - reconnectionAttempts: 5
      ↓
Backend chatSocket.js receives connection:
   - Extract token from socket.handshake.auth
   - Verify JWT signature
   - If invalid: Reject connection
   - If valid: Store user info on socket object
   - emit: "connection" event
      ↓
Socket.on("connect") triggered
      ↓
Frontend isConnected = true
      ↓
When user selects a chat:
   socket.emit("join_chat", String(chatId))
      ↓
Backend: socket.join(chatId) (joins Socket.IO room)
      ↓
Now receives all messages emitted to that room
```

### **Flow 12: Real-Time Message Reception**
```
User A sends message in Chat with User B
      ↓
User A's frontend emits socket.emit("send_message", {...})
      ↓
Backend inserts message and emits:
   io.to(chatId).emit("receive_message", { chatId, senderId, content })
      ↓
User B's socket (subscribed to chatId room) receives event
      ↓
ChatWindow.handleReceiveMessage() triggered:
   - Check if message is from another user (not self)
   - Create temporary message object
   - Check for duplicates (avoid double-rendering)
   - Add message to state
   - Trigger onMessageSent callback
   - Auto-scroll to bottom
      ↓
Message appears in real-time on User B's screen
```

---

## 📊 Database Schema

### **Users Table**
```sql
id (PRIMARY KEY, SERIAL)
name (VARCHAR)
email (VARCHAR, UNIQUE)
password (VARCHAR - hashed)
created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### **Chats Table**
```sql
id (PRIMARY KEY, SERIAL)
created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### **Chat Members Table**
```sql
id (PRIMARY KEY, SERIAL)
chat_id (FOREIGN KEY → chats.id, CASCADE DELETE)
user_id (FOREIGN KEY → users.id, CASCADE DELETE)
joined_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
UNIQUE(chat_id, user_id) - Prevents duplicate memberships
```

### **Messages Table**
```sql
id (PRIMARY KEY, SERIAL)
chat_id (FOREIGN KEY → chats.id, CASCADE DELETE)
sender_id (FOREIGN KEY → users.id, CASCADE DELETE)
content (TEXT)
created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

**Indexes:**
- `idx_chat_members_user` on `user_id`
- `idx_chat_members_chat` on `chat_id`
- `idx_messages_chat` on `chat_id`
- `idx_users_email` on `email`

---

## 🔐 Security Features

1. **Authentication**
   - JWT tokens with 1-day expiry
   - Bearer token format in Authorization header
   - Token stored securely in localStorage

2. **Authorization**
   - authMiddleware validates all protected routes
   - Message edit/delete: Ownership verification (sender_id === user.id)
   - Duplicate chat prevention via database UNIQUE constraint

3. **Password Security**
   - Bcrypt hashing with 10 rounds
   - Passwords never sent back in responses

4. **CORS**
   - Enabled on backend for frontend communication

5. **Socket.IO Authentication**
   - Token required for connection
   - JWT verified on every socket event

---

## 📁 API Endpoints Summary

### **Authentication**
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /auth/register | ❌ | Register new user |
| POST | /auth/login | ❌ | Login user, return JWT |
| GET | /auth/me | ✅ | Get current user info |
| GET | /auth/users | ✅ | Get all other users |

### **Chats**
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /chats | ✅ | Create new chat or return existing |
| GET | /chats | ✅ | Fetch all user's chats |

### **Messages**
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /chats/:chatId/messages | ✅ | Send message |
| GET | /chats/:chatId/messages | ✅ | Fetch all messages in chat |
| PUT | /chats/:chatId/messages/:messageId | ✅ | Edit message (owner only) |
| DELETE | /chats/:chatId/messages/:messageId | ✅ | Delete message (owner only) |

---

## 🏗️ Frontend Component Architecture

```
App.tsx (Route setup)
├── SocketProvider (WebSocket connection)
│   └── AuthProvider (Auth state)
│       ├── Login.tsx (Login page)
│       ├── Register.tsx (Register page)
│       └── ProtectedRoute
│           └── Chat.tsx (Main chat page)
│               ├── ChatList.tsx (Sidebar with chat list)
│               └── ChatWindow.tsx (Message display & input)
│                   ├── Load messages
│                   ├── Send message (Socket + REST)
│                   ├── Edit message
│                   ├── Delete message
│                   └── Real-time message reception
```

---

## 🔗 Key Implementation Details

### **ChatWindow.tsx - Message Sending Logic**
1. User types message and presses Enter
2. Message sent via Socket.IO (real-time to others)
3. Also sent via REST API (persistence guarantee)
4. Messages from API response added to state with correct ID
5. Messages from Socket (other users) added if not duplicate
6. Deduplication: Checks for duplicate content within 5 second window

### **ChatSocket.js - Server-Side Socket Handling**
1. Authenticates socket connection with JWT
2. Stores user info on socket object
3. Handles `join_chat` event to subscribe to room
4. Handles `send_message` event:
   - Inserts to database
   - Broadcasts to all users in chat room
5. Logs connection/disconnection

### **Authentication Flow**
- Token stored in localStorage after login
- Included in all REST API requests via axios interceptor
- Included in Socket.IO auth object during connection
- AuthContext manages token and current user state

---

## ✅ Working Features

- ✅ User registration and login
- ✅ Chat creation (with duplicate prevention)
- ✅ Send/receive messages in real-time
- ✅ View message history
- ✅ Edit own messages
- ✅ Delete own messages
- ✅ Responsive UI with animations
- ✅ Real-time Socket.IO communication
- ✅ Protected routes and API endpoints
- ✅ Proper error handling and validation

---

## 🐛 Potential Issues to Address

1. **Message ID inconsistency**: Socket messages use `Date.now()` as temporary ID
2. **Updated_at field**: Not returned in API responses (should be included)
3. **Edit indicator**: No visual "(edited)" text shown in UI currently
4. **Timestamp handling**: Need consistent timezone handling
5. **Message ordering**: Ensure chronological order maintained with new socket messages

---

## 📝 Notes

- Frontend uses hybrid approach: Socket.IO for real-time, REST for persistence
- Message deduplication prevents duplicate display
- All protected endpoints require valid JWT
- Socket.IO handles authentication via JWT in handshake
- Chat creation is idempotent (returns existing chat if one exists)

