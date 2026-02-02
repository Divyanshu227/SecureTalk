# SecureTalk - Black Box Function Documentation

This document describes all functions and components as black boxes, focusing on inputs, outputs, and purpose without implementation details.

## Table of Contents
1. [Backend Functions](#backend-functions)
2. [Frontend Components](#frontend-components)
3. [Frontend API Functions](#frontend-api-functions)
4. [Socket.IO Events](#socketio-events)
5. [Middleware & Utilities](#middleware--utilities)

---

## Backend Functions

### Authentication Controller Functions

#### `register(req, res)`
**Purpose:** Create a new user account

**Inputs:**
- `req.body.name` (string) - User's full name
- `req.body.email` (string) - User's email address
- `req.body.password` (string) - User's password

**Outputs:**
- **Success (201):** `{ message: "User registered successfully" }`
- **Conflict (409):** `{ message: "Email already exists" }`
- **Bad Request (400):** `{ message: "Missing fields" }`
- **Server Error (500):** `{ message: "Server error" }`

**Side Effects:** 
- Inserts new user into database with hashed password
- Password is irreversibly hashed using bcrypt

---

#### `login(req, res)`
**Purpose:** Authenticate user and return JWT token

**Inputs:**
- `req.body.email` (string) - User's email
- `req.body.password` (string) - User's password

**Outputs:**
- **Success (200):** `{ token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }`
- **Unauthorized (401):** `{ message: "Invalid credentials" }`
- **Server Error (500):** `{ message: "Server error" }`

**Side Effects:** None (read-only from database)

**Token Details:**
- Payload: `{ id: number, email: string }`
- Expires: 24 hours
- Used for subsequent authenticated requests

---

#### `getMe(req, res)`
**Purpose:** Retrieve current authenticated user's profile information

**Inputs:**
- `req.user.id` (number) - User ID from JWT token (set by authMiddleware)

**Outputs:**
- **Success (200):** `{ id: number, name: string, email: string }`
- **Not Found (404):** `{ message: "User not found" }`
- **Server Error (500):** `{ message: "Server error" }`

**Requirements:** 
- Must include valid JWT token in Authorization header
- Token must be verified by authMiddleware

---

#### `getAllUsers(req, res)`
**Purpose:** Get list of all users except the current authenticated user

**Inputs:**
- `req.user.id` (number) - Current user ID from JWT token

**Outputs:**
- **Success (200):** `[ { id: number, name: string, email: string }, ... ]`
- **Server Error (500):** `{ message: "Server error" }`

**Details:**
- Returns users sorted alphabetically by name
- Excludes the authenticated user from results

---

### Chat Controller Functions

#### `createChat(req, res)`
**Purpose:** Create a new chat between two users or return existing chat

**Inputs:**
- `req.user.id` (number) - Current user ID from JWT token
- `req.body.otherUserId` (number) - ID of the user to chat with

**Outputs:**
- **Success (200):** `{ chatId: number }`
- **Server Error (500):** `{ message: "Server error" }`

**Behavior:**
- Checks if chat already exists between the two users
- If exists: returns existing chatId
- If not exists: creates new chat and adds both users as members

**Side Effects:**
- Creates new chat row in `chats` table
- Inserts two rows into `chat_members` table (one for each user)

---

#### `getChats(req, res)`
**Purpose:** Retrieve all chats for the authenticated user with last message preview

**Inputs:**
- `req.user.id` (number) - Current user ID from JWT token

**Outputs:**
- **Success (200):** 
```javascript
[
  {
    id: number,
    lastMessage: string | null,
    otherUser: {
      id: number,
      name: string,
      email: string
    }
  },
  ...
]
```
- **Server Error (500):** `{ message: "Server error" }`

**Details:**
- Ordered by most recent message first
- Returns other user's information for each chat
- Includes null if no messages in chat

---

### Message Controller Functions

#### `sendMessage(req, res)`
**Purpose:** Save a new message to the database

**Inputs:**
- `req.params.chatId` (number) - ID of the chat
- `req.body.content` (string) - Message text content
- `req.user.id` (number) - Sender's user ID from JWT token

**Outputs:**
- **Success (200):** 
```javascript
{
  id: number,
  chat_id: number,
  senderId: number,
  content: string,
  created_at: ISO8601 timestamp
}
```
- **Server Error (500):** `{ message: "Failed to send message" }`

**Side Effects:**
- Inserts message into `messages` table
- `created_at` automatically set to current server time

---

#### `getMessages(req, res)`
**Purpose:** Retrieve all messages from a specific chat

**Inputs:**
- `req.params.chatId` (number) - ID of the chat

**Outputs:**
- **Success (200):** 
```javascript
[
  {
    id: number,
    senderId: number,
    content: string,
    created_at: ISO8601 timestamp
  },
  ...
]
```
- **Server Error (500):** `{ message: "Failed to fetch messages" }`

**Details:**
- Returns messages ordered chronologically (oldest first)
- Returns empty array if chat has no messages

---

#### `editMessage(req, res)`
**Purpose:** Update the content of an existing message

**Inputs:**
- `req.params.chatId` (number) - Chat ID
- `req.params.messageId` (number) - Message ID to edit
- `req.body.content` (string) - New message content
- `req.user.id` (number) - Current user ID (from JWT)

**Outputs:**
- **Success (200):** 
```javascript
{
  id: number,
  senderId: number,
  content: string,
  created_at: ISO8601 timestamp
}
```
- **Not Found (404):** `{ message: "Message not found" }`
- **Unauthorized (403):** `{ message: "Unauthorized" }`
- **Server Error (500):** `{ message: "Failed to edit message" }`

**Authorization:**
- Only the message sender can edit their own message
- Returns 403 if user is not the sender

---

#### `deleteMessage(req, res)`
**Purpose:** Delete a message from a chat

**Inputs:**
- `req.params.chatId` (number) - Chat ID
- `req.params.messageId` (number) - Message ID to delete
- `req.user.id` (number) - Current user ID (from JWT)

**Outputs:**
- **Success (200):** `{ message: "Message deleted" }`
- **Not Found (404):** `{ message: "Message not found" }`
- **Unauthorized (403):** `{ message: "Unauthorized" }`
- **Server Error (500):** `{ message: "Failed to delete message" }`

**Authorization:**
- Only the message sender can delete their own message

**Side Effects:**
- Removes message from `messages` table permanently

---

## Frontend Components

### Page Components

#### `Login`
**Purpose:** Display login form and handle user authentication

**Props:** None

**State:**
- `email` (string) - Email input field
- `password` (string) - Password input field
- `loading` (boolean) - Indicates if login request is in progress
- `error` (string) - Error message to display

**Outputs to User:**
- Login form with email and password fields
- Error message if login fails
- Loading state indicator

**Side Effects on Success:**
- Stores JWT token in localStorage
- Fetches and stores user data in localStorage
- Updates AuthContext with token and user
- Navigates to home page "/"

---

#### `Register`
**Purpose:** Display registration form and handle new user creation

**Props:** None

**State:**
- `name` (string) - User name input
- `email` (string) - Email input
- `password` (string) - Password input
- `confirmPassword` (string) - Password confirmation input
- `loading` (boolean) - Request in progress indicator
- `error` (string) - Error message display

**Outputs to User:**
- Registration form with required fields
- Error message if registration fails
- Loading state indicator

**Side Effects on Success:**
- Creates user account in backend
- Displays success message
- Navigates to login page

---

#### `Chat`
**Purpose:** Main chat interface displaying chat list and selected chat

**Props:** None

**State:**
- `chats` (Chat[]) - List of user's chats
- `activeChat` (Chat | null) - Currently selected chat
- `showNewChatModal` (boolean) - Modal visibility toggle
- `users` (User[]) - Available users to start new chat with
- `loadingUsers` (boolean) - Users list loading state

**Renders:**
- Chat sidebar with chat list
- Chat window for selected chat
- New chat modal
- Logout button
- Theme toggle

**Side Effects:**
- Fetches chat list on component mount
- Establishes Socket.IO connection (via SocketContext)
- Loads users when opening new chat modal

---

### UI Components

#### `ChatList`
**Purpose:** Display list of all user's chats with preview

**Props:**
- `chats` (Chat[]) - Array of chat objects
- `activeChat` (Chat | null) - Currently selected chat
- `onSelectChat` (function) - Callback when chat is selected

**Outputs:**
- Rendered list of chats
- Highlights active chat
- Shows last message preview for each chat

**Behavior:**
- Clicking a chat triggers `onSelectChat` callback
- Each chat shows: other user's name, last message, and metadata

---

#### `ChatWindow`
**Purpose:** Display messages and handle message input for selected chat

**Props:**
- `chat` (Chat | null) - Currently selected chat object
- `onClose` (function) - Callback to close chat

**State:**
- `messages` (Message[]) - Array of messages in chat
- `messageInput` (string) - Current message being typed
- `loading` (boolean) - Messages loading state

**Outputs:**
- List of messages with sender info and timestamps
- Message input field
- Send button
- Edit/delete buttons for user's own messages

**Side Effects:**
- Fetches message history on mount
- Emits "join_chat" via Socket.IO
- Listens for "receive_message" events
- Sends messages via Socket.IO

---

#### `ThemeToggle`
**Purpose:** Button to switch between light and dark themes

**Props:** None

**Outputs:**
- Toggle button showing current theme icon

**Side Effects:**
- Updates ThemeContext when clicked
- Changes CSS class on document root

---

#### `ProtectedRoute`
**Purpose:** Wrapper component to protect routes requiring authentication

**Props:**
- `children` (JSX.Element) - Component to render if authenticated

**Behavior:**
- Checks if JWT token exists in AuthContext
- If token exists: renders children
- If no token: redirects to "/login"

**No Outputs:** (React Router component)

---

### Context Providers

#### `AuthProvider`
**Purpose:** Global authentication state management

**Props:**
- `children` (ReactNode) - Child components to wrap

**Provides:**
```typescript
{
  token: string | null,
  user: User | null,
  login: (jwt: string, userData: User) => void,
  logout: () => void
}
```

**Behavior:**
- Loads token and user from localStorage on mount
- Persists token and user to localStorage on login
- Clears localStorage on logout
- Provides useAuth hook for all components

**State Persistence:** localStorage

---

#### `SocketProvider`
**Purpose:** WebSocket connection management

**Props:**
- `children` (ReactNode) - Child components to wrap

**Provides:**
```typescript
{
  socket: Socket | null
}
```

**Connection Details:**
- Creates Socket.IO connection only if user has valid token
- Sends JWT token during handshake
- Implements auto-reconnection with exponential backoff
- Disconnects when token is cleared

**Reconnection Config:**
- Initial delay: 1000ms
- Max delay: 5000ms
- Max attempts: 5

---

#### `ThemeProvider`
**Purpose:** Theme state management (light/dark mode)

**Props:**
- `children` (ReactNode) - Child components to wrap

**Provides:**
```typescript
{
  isDarkMode: boolean,
  toggleTheme: () => void
}
```

**Behavior:**
- Reads system preference on first load
- Persists theme choice to localStorage
- Updates document root class for CSS theme switching

---

## Frontend API Functions

### Authentication API

#### `registerUser(name, email, password)`
**Purpose:** Send registration request to backend

**Inputs:**
- `name` (string) - User's full name
- `email` (string) - User's email
- `password` (string) - User's password

**Outputs:**
- **Success:** `{ message: "User registered successfully" }`
- **Error:** Throws axios error with response

**HTTP Method:** POST `/auth/register`

---

#### `loginUser(email, password)`
**Purpose:** Authenticate user and retrieve JWT token

**Inputs:**
- `email` (string) - User's email
- `password` (string) - User's password

**Outputs:**
- **Success:** `{ token: string }`
- **Error:** Throws axios error with response

**HTTP Method:** POST `/auth/login`

---

#### `fetchMe()`
**Purpose:** Get current user's profile information

**Inputs:** None (uses token from Authorization header)

**Outputs:**
- **Success:** 
```typescript
{
  id: number,
  name: string,
  email: string
}
```
- **Error:** Throws axios error

**HTTP Method:** GET `/auth/me`
**Requires:** Valid JWT token in Authorization header

---

### Chat API

#### `fetchChats()`
**Purpose:** Retrieve all chats for authenticated user

**Inputs:** None

**Outputs:**
- **Success:** Array of chats with format:
```typescript
[
  {
    id: number,
    lastMessage: string | null,
    otherUser: {
      id: number,
      name: string,
      email: string
    }
  },
  ...
]
```
- **Error:** Throws axios error

**HTTP Method:** GET `/chats`
**Requires:** Valid JWT token

---

#### `createChat(otherUserId)`
**Purpose:** Create new chat with another user

**Inputs:**
- `otherUserId` (number) - ID of user to chat with

**Outputs:**
- **Success:** `{ chatId: number }`
- **Error:** Throws axios error

**HTTP Method:** POST `/chats`
**Body:** `{ otherUserId: number }`

---

#### `fetchUsers()`
**Purpose:** Get list of available users to start chat with

**Inputs:** None

**Outputs:**
- **Success:** 
```typescript
[
  {
    id: number,
    name: string,
    email: string
  },
  ...
]
```
- **Error:** Throws axios error

**HTTP Method:** GET `/auth/users`
**Requires:** Valid JWT token

---

### Message API

#### `fetchMessages(chatId)`
**Purpose:** Retrieve all messages from a specific chat

**Inputs:**
- `chatId` (number) - ID of the chat

**Outputs:**
- **Success:**
```typescript
[
  {
    id: number,
    senderId: number,
    content: string,
    createdAt: ISO8601 timestamp
  },
  ...
]
```
- **Error:** Throws axios error

**HTTP Method:** GET `/chats/{chatId}/messages`

---

#### `sendMessage(chatId, content)`
**Purpose:** Save a new message to database (via REST API)

**Inputs:**
- `chatId` (number) - Chat ID
- `content` (string) - Message text

**Outputs:**
- **Success:**
```typescript
{
  id: number,
  senderId: number,
  content: string,
  createdAt: ISO8601 timestamp
}
```
- **Error:** Throws axios error

**HTTP Method:** POST `/chats/{chatId}/messages`
**Note:** Messages are primarily sent via Socket.IO for real-time updates

---

#### `editMessage(chatId, messageId, content)`
**Purpose:** Update message content

**Inputs:**
- `chatId` (number) - Chat ID
- `messageId` (number) - Message ID to edit
- `content` (string) - New message content

**Outputs:**
- **Success:**
```typescript
{
  id: number,
  senderId: number,
  content: string,
  createdAt: ISO8601 timestamp
}
```
- **Error:** Throws axios error

**HTTP Method:** PUT `/chats/{chatId}/messages/{messageId}`

---

#### `deleteMessage(chatId, messageId)`
**Purpose:** Delete a message

**Inputs:**
- `chatId` (number) - Chat ID
- `messageId` (number) - Message ID to delete

**Outputs:**
- **Success:** `{ message: "Message deleted" }`
- **Error:** Throws axios error

**HTTP Method:** DELETE `/chats/{chatId}/messages/{messageId}`

---

## Socket.IO Events

### Client → Server Events

#### `join_chat`
**Purpose:** Join a chat room for real-time updates

**Data Sent:**
- `chatId` (number) - ID of chat to join

**Response:** None (async operation)

**Side Effect:** Adds socket to room, enables receiving broadcasts for that chat

---

#### `send_message`
**Purpose:** Send a message in real-time to all chat participants

**Data Sent:**
```javascript
{
  chatId: number,
  content: string
}
```

**Response:** Message is persisted to database and broadcast to room

**Side Effects:**
- Inserts message into database
- Broadcasts to all sockets in chat room

---

### Server → Client Events

#### `receive_message`
**Purpose:** Receive new message broadcast from server

**Data Received:**
```javascript
{
  chatId: number,
  senderId: number,
  content: string
}
```

**Listener Location:** ChatWindow component
**Side Effect:** Updates local message state in React

---

#### `connect`
**Purpose:** Socket.IO connection established

**Triggered:** When WebSocket handshake successful
**Listener:** SocketProvider
**Side Effect:** Sets socket instance in context

---

#### `disconnect`
**Purpose:** Socket disconnected from server

**Triggered:** When connection closed or lost
**Listener:** SocketProvider
**Side Effect:** Sets socket to null in context

---

## Middleware & Utilities

### Authentication Middleware

#### `authMiddleware(req, res, next)`
**Purpose:** Validate JWT token and attach user info to request

**Inputs:**
- `req.headers.authorization` (string) - Authorization header with "Bearer <token>"

**Outputs:**
- **Valid Token:** Attaches `req.user = { id, email }` and calls `next()`
- **No Token (401):** Returns `{ message: "No token provided" }`
- **Invalid Token (401):** Returns `{ message: "Invalid token" }`

**Behavior:**
- Extracts token from "Authorization: Bearer <token>" format
- Verifies token using JWT_SECRET
- Halts request if token invalid
- Continues to route handler if token valid

**Applied To:** All routes except `/auth/register` and `/auth/login`

---

### Socket.IO Middleware

#### `io.use((socket, next))`
**Purpose:** Authenticate Socket.IO connections with JWT

**Inputs:**
- `socket.handshake.auth.token` (string) - JWT token from client

**Outputs:**
- **Valid Token:** Sets `socket.user = { id, email }` and calls `next()`
- **No Token:** Returns error "Authentication token missing"
- **Invalid Token:** Returns error "Invalid authentication token"

**Behavior:**
- Runs before any socket event handlers
- Rejects connection if token invalid
- Allows connection if token valid

---

### Axios Interceptor

#### `api` instance
**Purpose:** Configure axios with authentication headers

**Interceptor:** Request interceptor adds Authorization header

**Behavior:**
- Automatically includes JWT token in all API requests
- Retrieves token from localStorage
- Format: `Authorization: Bearer <token>`

**Applied To:** All HTTP requests made with `api.*` methods

---

### Database Connection

#### `pool`
**Purpose:** PostgreSQL connection pool for database operations

**Inputs (Configuration):**
- `PG_HOST` - Database server hostname
- `PG_PORT` - Database port
- `PG_USER` - Database user
- `PG_PASSWORD` - Database password
- `PG_DATABASE` - Database name

**Methods:**
- `pool.query(sql, values)` - Execute SQL query with parameters
- Returns promise resolving to result object

**Initialization:** Validates connection with `SELECT 1` query

---

### HTTP Server

#### `server` (HTTP Server)
**Purpose:** Create HTTP server wrapping Express app and enabling Socket.IO

**Inputs:**
- `app` (Express application)

**Outputs:**
- HTTP server instance listening on specified port
- Socket.IO server attached to handle WebSocket connections

**Port:** `process.env.PORT || 5000`

**Side Effects:**
- Logs startup message to console
- Begins listening for incoming connections

---

## Type Definitions

### User Type
```typescript
{
  id: number,
  name: string,
  email: string
}
```

### Chat Type
```typescript
{
  id: number,
  lastMessage: string | null,
  otherUser: {
    id: number,
    name: string,
    email: string
  }
}
```

### Message Type
```typescript
{
  id: number,
  senderId: number,
  content: string,
  createdAt: ISO8601 timestamp
}
```

### AuthContextType
```typescript
{
  token: string | null,
  user: User | null,
  login: (jwt: string, userData: User) => void,
  logout: () => void
}
```

---

## Summary

This document provides a complete black box view of:
- **19 Backend Functions** (Auth, Chat, Message controllers)
- **7 Frontend Components** (Pages and UI components)
- **1 Component Wrapper** (ProtectedRoute)
- **3 Context Providers** (Auth, Socket, Theme)
- **8 Frontend API Functions** (Auth, Chat, Message APIs)
- **3 Socket.IO Events** (join_chat, send_message, receive_message)
- **3 Middleware/Utilities** (Auth middleware, Socket auth, Database)

Each entry documents:
- **Purpose:** What the function/component does
- **Inputs:** What parameters it accepts
- **Outputs:** What it returns or displays
- **Side Effects:** What state changes occur
- **Special Details:** Authorization, persistence, configuration, etc.
