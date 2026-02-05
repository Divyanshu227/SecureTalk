# SecureTalk Application - Detailed Workflow Documentation

This document provides an in-depth explanation of every step, function, and process in the SecureTalk application from server startup to real-time messaging.

## Table of Contents
1. [Initial Setup & Server Startup](#initial-setup--server-startup)
2. [User Authentication Flow](#user-authentication-flow)
3. [Chat Management Flow](#chat-management-flow)
4. [Real-time Messaging Flow](#real-time-messaging-flow)
5. [Message Operations Flow](#message-operations-flow)
6. [Socket.IO Communication](#socketio-communication)
7. [Frontend State Management](#frontend-state-management)
8. [Complete User Journey](#complete-user-journey)

---

## Initial Setup & Server Startup

### Phase 1: Backend Initialization

#### Step 1.1: Server Entry Point (`Backend/server.js`)
When you run `npm start` or `npm run dev`, Node.js executes `server.js`:

```javascript
import app from "./src/app.js";
import pool from "./src/config/db.js";
```

**What happens:**
- Imports the Express app configuration from `src/app.js`
- Imports the database connection pool from `src/config/db.js`
- These are initialized FIRST before the server starts

#### Step 1.2: Database Connection (`Backend/src/config/db.js`)

```javascript
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: String(process.env.PG_PASSWORD),
  database: process.env.PG_DATABASE,
});

pool.query("SELECT 1")
  .then(() => console.log("✅ Postgres connected"))
  .catch(err => {
    console.error("❌ DB connection error:", err.message);
    process.exit(1);
  });
```

**What happens:**
- Creates a PostgreSQL connection pool using environment variables
- Environment variables are loaded from `.env` file via `dotenv.config()`
- Executes `SELECT 1` query to verify database is accessible
- If connection succeeds: prints "✅ Postgres connected"
- If connection fails: prints error and exits process (prevents server running without DB)
- This pool is used for ALL database queries throughout the application

#### Step 1.3: Express App Configuration (`Backend/src/app.js`)

```javascript
const app = express();
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});
app.use("/auth", authRoutes);
app.use("/chats", chatRoutes);
```

**What happens:**
- Creates Express application instance
- Enables JSON body parsing: converts incoming request bodies from JSON to JavaScript objects
- Enables CORS (Cross-Origin Resource Sharing): allows frontend on different domain to make requests
- Adds logging middleware: logs every incoming HTTP request with method and URL
- Registers auth routes at `/auth` path
- Registers chat routes at `/chats` path

#### Step 1.4: HTTP Server & Socket.IO Setup

```javascript
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
initChatSocket(io);

server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});
```

**What happens:**
- Creates HTTP server wrapping Express app (Socket.IO requires HTTP server)
- Creates Socket.IO server instance with CORS enabled (allows connections from any origin)
- Calls `initChatSocket(io)` to initialize Socket.IO event handlers (explained later)
- Starts server listening on port 5000 (or PORT env variable if set)
- Prints confirmation message when server is ready

---

## User Authentication Flow

### Phase 2: User Registration

#### Step 2.1: Frontend Registration Form (`chat-frontend/src/pages/Register.tsx`)

User fills registration form with:
- Email
- Password
- Confirm Password

User clicks "Register" button → `handleSubmit` function executes

#### Step 2.2: Send Registration Request to Backend

Frontend calls: `registerUser(name, email, password)` from `chat-frontend/src/api/auth.ts`

```typescript
export const registerUser = async (
  name: string,
  email: string,
  password: string
): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/register", {
    name,
    email,
    password,
  });
  return res.data;
};
```

**What happens:**
- Uses Axios to POST request to backend `http://localhost:5000/auth/register`
- Sends JSON body with name, email, password
- Returns the response message from server

#### Step 2.3: Backend Receives Registration Request

Express routes request to `Backend/src/controllers/authcontroller.js` → `register` function

```javascript
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  // Validate: both email and password are provided
  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // Check if email already exists in database
  const existing = await pool.query(
    "SELECT id FROM users WHERE email=$1",
    [email]
  );

  if (existing.rowCount > 0) {
    return res.status(409).json({ message: "Email already exists" });
  }

  // Hash password using bcrypt (one-way encryption)
  // 10 = salt rounds (higher = more secure but slower)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new user into database
  await pool.query(
    "INSERT INTO users (name, email, password) VALUES ($1,$2,$3)",
    [name, email, hashedPassword]
  );

  res.status(201).json({ message: "User registered successfully" });
};
```

**Detailed execution:**

1. **Extract Request Data**: Gets name, email, password from request body
2. **Validate Input**: Checks email and password are not empty
   - If missing: returns 400 (Bad Request) error
3. **Check Email Uniqueness**: Queries database for existing user with same email
   ```sql
   SELECT id FROM users WHERE email=$1
   ```
   - If found: returns 409 (Conflict) error
4. **Hash Password**: Uses bcrypt to hash password
   - Original: `"mypassword123"`
   - Hashed: `"$2b$10$N9qo8uLOickgx2...XXXXXX"` (never stores original)
   - Bcrypt is one-way: can't reverse hash to get password
5. **Insert User**: Executes SQL INSERT
   ```sql
   INSERT INTO users (name, email, password) VALUES ($1,$2,$3)
   ```
   - Parameters: name, email, hashedPassword
6. **Return Success**: Sends 201 (Created) status with success message

#### Step 2.4: User Registration Complete

Frontend receives response → displays success message → redirects to Login page

---

### Phase 3: User Login

#### Step 3.1: Frontend Login Form

User enters:
- Email
- Password

User clicks "Login" → `handleSubmit` executes

#### Step 3.2: Send Login Request

Frontend calls `loginUser(email, password)`:

```typescript
export const loginUser = async (
  email: string,
  password: string
): Promise<{ token: string }> => {
  const res = await api.post<{ token: string }>("/auth/login", {
    email,
    password,
  });
  return res.data;
};
```

Sends POST to `http://localhost:5000/auth/login` with email and password

#### Step 3.3: Backend Login Processing

Routes to `Backend/src/controllers/authcontroller.js` → `login` function

```javascript
export const login = async (req, res) => {
  const { email, password } = req.body;

  // Query database for user with matching email
  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const user = result.rows[0]; // Get the user object

  // Compare provided password with stored hash using bcrypt
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Create JWT (JSON Web Token) containing user ID and email
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" } // Token valid for 1 day
  );

  res.json({ token });
};
```

**Detailed execution:**

1. **Find User**: Queries database for user with matching email
   ```sql
   SELECT * FROM users WHERE email=$1
   ```
   - If not found: returns 401 (Unauthorized) error
2. **Verify Password**: Uses bcrypt to compare
   - Takes plain password from request
   - Takes hashed password from database
   - Bcrypt checks if they match (securely, without revealing password)
   - If no match: returns 401 error
3. **Create JWT Token**: 
   - Payload: `{ id: 123, email: "user@example.com" }`
   - Secret: `process.env.JWT_SECRET` (from .env file)
   - Expiration: 24 hours
   - Result: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long encoded string)
4. **Send Token**: Returns token to frontend

#### Step 3.4: Frontend Stores Token & User Data

```javascript
const handleSubmit = async (e: React.FormEvent) => {
  // ... validation code ...
  
  const { token } = await loginUser(email, password);
  localStorage.setItem("token", token); // Store token in browser
  
  const user = await fetchMe(); // Fetch user details
  login(token, user); // Update AuthContext
  navigate("/"); // Redirect to chat page
};
```

**What happens:**
1. Receives JWT token from server
2. Stores token in `localStorage` (persists across page refreshes)
3. Calls `fetchMe()` to get user details using token
4. Calls `login(token, user)` to update React context
5. Redirects to home page "/"

#### Step 3.5: Fetch Current User Details

Frontend calls `fetchMe()`:

```typescript
export const fetchMe = async (): Promise<User> => {
  const res = await api.get<User>("/auth/me");
  return res.data;
};
```

This GET request includes JWT token in Authorization header (set by Axios interceptor):
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Step 3.6: Backend Validates Token & Returns User

Request goes through `authMiddleware.js`:

```javascript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next(); // Continue to route handler
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
```

**What happens:**
1. Extracts token from `Authorization: Bearer <token>`
2. Verifies token using JWT secret
3. If valid: extracts user ID and email, attaches to `req.user`
4. If invalid: returns 401 error
5. Calls `next()` to proceed to route handler

Then handles `GET /auth/me`:

```javascript
export const getMe = async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id=$1",
    [req.user.id] // req.user was set by middleware
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(result.rows[0]); // Returns user object
};
```

**Execution:**
1. Uses `req.user.id` (from JWT token) to query database
2. Returns user's id, name, and email
3. Frontend receives and stores in AuthContext

#### Step 3.7: AuthContext Storage

Frontend's `AuthContext.tsx` stores authentication state:

```javascript
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token") // Load from localStorage on startup
  );

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (jwt: string, userData: User) => {
    localStorage.setItem("token", jwt); // Persist token
    localStorage.setItem("user", JSON.stringify(userData)); // Persist user
    setToken(jwt); // Update React state
    setUser(userData); // Update React state
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };
};
```

**What happens:**
- Stores token and user data in React state AND localStorage
- localStorage persists even after page refresh
- On app startup, retrieves from localStorage
- `ProtectedRoute` component checks if token exists:
  - If yes: shows protected page
  - If no: redirects to login page

---

## Chat Management Flow

### Phase 4: Viewing Chat List

#### Step 4.1: Chat Page Loads

User is redirected to "/" (Chat page) after login

```javascript
useEffect(() => {
  loadChats();
}, []);
```

`loadChats()` function executes:

```javascript
const loadChats = async () => {
  try {
    const data = await fetchChats();
    setChats(data);
  } catch (err) {
    console.error("Failed to load chats");
  }
};
```

#### Step 4.2: Frontend Requests Chat List

Calls `fetchChats()` from `chat-frontend/src/api/chat.ts`:

```typescript
export const fetchChats = async (): Promise<Chat[]> => {
  const res = await api.get<Chat[]>("/chats");
  return res.data;
};
```

Sends GET request to `http://localhost:5000/chats` with JWT token in header

#### Step 4.3: Backend Retrieves Chats

Request goes through auth middleware (validates JWT), then to `chatController.getChats`:

```javascript
export const getChats = async (req, res) => {
  const result = await pool.query(
    `
    SELECT c.id, 
           MAX(m.content) AS last_message,
           u.id as other_user_id,
           u.name as other_user_name,
           u.email as other_user_email
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chat_id
    JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id != $1
    JOIN users u ON cm2.user_id = u.id
    LEFT JOIN messages m ON c.id = m.chat_id
    WHERE cm.user_id = $1
    GROUP BY c.id, u.id, u.name, u.email
    ORDER BY MAX(m.created_at) DESC
    `,
    [req.user.id]
  );

  const chats = result.rows.map(row => ({
    id: row.id,
    lastMessage: row.last_message,
    otherUser: {
      id: row.other_user_id,
      name: row.other_user_name,
      email: row.other_user_email
    }
  }));

  res.json(chats);
};
```

**Detailed Query Breakdown:**

The SQL query is complex. Let me explain step by step:

```sql
SELECT c.id, 
       MAX(m.content) AS last_message,
       u.id as other_user_id,
       u.name as other_user_name,
       u.email as other_user_email
FROM chats c
```
- Selects chat ID, last message, and other user's details
- Starts with `chats` table as base

```sql
JOIN chat_members cm ON c.id = cm.chat_id
```
- Links to `chat_members` table (records which user is in which chat)
- `cm` represents current user's membership

```sql
JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id != $1
```
- Links to `chat_members` again
- `cm2` represents OTHER user's membership
- `cm2.user_id != $1` ensures we get the OTHER user (not current user)

```sql
JOIN users u ON cm2.user_id = u.id
```
- Links to `users` table to get other user's name and email

```sql
LEFT JOIN messages m ON c.id = m.chat_id
```
- `LEFT JOIN` means include chats even if no messages
- Gets the messages in this chat

```sql
WHERE cm.user_id = $1
```
- Filters to only chats where current user is a member
- `$1` is the user ID from `req.user.id`

```sql
GROUP BY c.id, u.id, u.name, u.email
ORDER BY MAX(m.created_at) DESC
```
- Groups by chat to get `MAX(m.content)` (last message)
- Orders by most recent message first

#### Step 4.4: Format & Return Results

Results are transformed from database rows to readable format:

```javascript
const chats = result.rows.map(row => ({
  id: row.id,
  lastMessage: row.last_message,
  otherUser: {
    id: row.other_user_id,
    name: row.other_user_name,
    email: row.other_user_email
  }
}));

res.json(chats);
```

Frontend receives:
```javascript
[
  {
    id: 1,
    lastMessage: "Hey, how are you?",
    otherUser: {
      id: 2,
      name: "Alice",
      email: "alice@example.com"
    }
  },
  {
    id: 2,
    lastMessage: "See you tomorrow",
    otherUser: {
      id: 3,
      name: "Bob",
      email: "bob@example.com"
    }
  }
]
```

#### Step 4.5: Frontend Display Chat List

React component receives data and renders:

```javascript
<ChatList chats={chats} activeChat={activeChat} onSelectChat={setActiveChat} />
```

Each chat is displayed showing:
- Other user's name
- Last message preview
- Click to select chat

---

### Phase 5: Creating New Chat

#### Step 5.1: User Clicks "+ New Chat"

Click opens modal showing list of all users

```javascript
const handleNewChat = async (userId: number) => {
  const { chatId } = await createChat(userId);
  await loadChats();
  setShowNewChatModal(false);
  const newChat = chats.find(c => c.id === chatId);
  if (newChat) {
    setActiveChat(newChat);
  }
};
```

#### Step 5.2: Backend Fetches All Users

First, modal calls `fetchUsers()`:

```typescript
export const fetchUsers = async (): Promise<{ id: number; name: string; email: string }[]> => {
  const res = await api.get<{ id: number; name: string; email: string }[]>("/auth/users");
  return res.data;
};
```

Backend's `getAllUsers`:

```javascript
export const getAllUsers = async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id != $1 ORDER BY name",
    [req.user.id]
  );

  res.json(result.rows);
};
```

**What happens:**
- Queries all users EXCEPT current user (`id != $1`)
- Orders by name alphabetically
- Returns list of users to display in modal

#### Step 5.3: User Selects Another User & Creates Chat

User clicks on user in modal → calls `createChat(userId)`

```typescript
export const createChat = async (otherUserId: number): Promise<{ chatId: number }> => {
  const res = await api.post<{ chatId: number }>("/chats", {
    otherUserId,
  });
  return res.data;
};
```

Sends POST to `/chats` with `otherUserId`

#### Step 5.4: Backend Creates/Returns Chat

Backend's `createChat`:

```javascript
export const createChat = async (req, res) => {
  const { otherUserId } = req.body;

  // Check if chat already exists between these two users
  const existingChat = await pool.query(
    `
    SELECT c.id FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
    JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
    `,
    [req.user.id, otherUserId]
  );

  if (existingChat.rowCount > 0) {
    return res.json({ chatId: existingChat.rows[0].id }); // Return existing chat
  }

  // If no existing chat, create new one
  const chatRes = await pool.query(
    "INSERT INTO chats DEFAULT VALUES RETURNING id"
  );

  const chatId = chatRes.rows[0].id;

  // Add both users as members of the chat
  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id) VALUES ($1,$2), ($1,$3)",
    [chatId, req.user.id, otherUserId]
  );

  res.json({ chatId });
};
```

**Detailed execution:**

1. **Check Existing Chat**: Looks for chat containing BOTH users
   ```sql
   SELECT c.id FROM chats c
   JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1  -- Current user
   JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2  -- Other user
   ```
   - If found: returns that chat ID (prevent duplicate chats)
   
2. **Create Chat**: If no existing chat
   ```sql
   INSERT INTO chats DEFAULT VALUES RETURNING id
   ```
   - Creates new row in `chats` table
   - Returns the new chat ID

3. **Add Members**: Adds both users to `chat_members`
   ```sql
   INSERT INTO chat_members (chat_id, user_id) 
   VALUES ($1,$2), ($1,$3)
   ```
   - First value pair: chat_id, current user ID
   - Second value pair: chat_id, other user ID

#### Step 5.5: Frontend Updates Chat List

```javascript
const { chatId } = await createChat(userId);
await loadChats(); // Refresh chat list from server
setShowNewChatModal(false); // Close modal
const newChat = chats.find(c => c.id === chatId); // Find new chat
if (newChat) {
  setActiveChat(newChat); // Open the new chat
}
```

Chat list is reloaded, and new chat is automatically opened

---

## Real-time Messaging Flow

### Phase 6: WebSocket Connection

#### Step 6.1: User Opens Chat

When user selects a chat, `ChatWindow` component mounts:

```javascript
useEffect(() => {
  if (!activeChat || !socket) return;
  
  // Join the chat room via Socket.IO
  socket.emit("join_chat", activeChat.id);
  
  // Load existing messages
  loadMessages();
}, [activeChat, socket]);
```

#### Step 6.2: Join Chat Room

Frontend Socket.IO client emits:

```javascript
socket.emit("join_chat", activeChat.id);
```

#### Step 6.3: Backend Receives Join Event

Server's Socket.IO handler processes the event:

```javascript
socket.on("join_chat", (chatId) => {
  socket.join(chatId);
  console.log(`User ${socket.user.id} joined chat ${chatId}`);
});
```

**What happens:**
- Socket.IO adds this socket to a "room" named after the chat ID
- Now, when messages are sent to this chat, they're broadcast to all sockets in that room
- This enables real-time updates for all users in the chat

#### Step 6.4: Load Existing Messages

```javascript
const loadMessages = async () => {
  try {
    const data = await fetchMessages(activeChat.id);
    setMessages(data);
  } catch (err) {
    console.error("Failed to load messages");
  }
};
```

Calls `fetchMessages`:

```typescript
export const fetchMessages = async (chatId: number): Promise<Message[]> => {
  const res = await api.get<Message[]>(`/chats/${chatId}/messages`);
  return res.data;
};
```

#### Step 6.5: Backend Returns Message History

Route to `messageController.getMessages`:

```javascript
export const getMessages = async (req, res) => {
  const { chatId } = req.params;

  const result = await pool.query(
    `
    SELECT id, sender_id as senderId, content, created_at
    FROM messages
    WHERE chat_id = $1
    ORDER BY created_at
    `,
    [chatId]
  );

  res.json(result.rows);
};
```

**Execution:**
- Queries all messages in the chat
- Orders by creation time (oldest first)
- Returns to frontend

Frontend receives and displays existing messages in chat window

---

### Phase 7: Sending Messages

#### Step 7.1: User Types & Sends Message

User types message and clicks Send:

```javascript
const handleSendMessage = (content: string) => {
  if (!socket || !activeChat) return;
  
  socket.emit("send_message", {
    chatId: activeChat.id,
    content,
  });
};
```

Frontend emits via Socket.IO:
```javascript
socket.emit("send_message", {
  chatId: 1,
  content: "Hello, how are you?"
});
```

#### Step 7.2: Backend Receives & Saves Message

Server's Socket.IO handler:

```javascript
socket.on("send_message", async (data) => {
  try {
    const { chatId, content } = data;
    const senderId = socket.user.id; // From JWT verification

    if (!chatId || !content) {
      return; // Silently ignore invalid messages
    }

    // Save to database
    await pool.query(
      "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1,$2,$3)",
      [chatId, senderId, content]
    );

    // Broadcast to all users in this chat
    io.to(chatId).emit("receive_message", {
      chatId,
      senderId,
      content,
    });

  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err.message);
  }
});
```

**Detailed execution:**

1. **Extract Data**: Gets chatId and content from emitted data
2. **Get Sender ID**: Uses `socket.user.id` (extracted from JWT during Socket.IO authentication)
3. **Validate**: Checks both chatId and content exist
4. **Save to Database**:
   ```sql
   INSERT INTO messages (chat_id, sender_id, content) 
   VALUES ($1,$2,$3)
   ```
   - Inserts message into `messages` table with:
     - chat_id: which chat
     - sender_id: who sent it
     - content: message text
     - created_at: automatically set to current timestamp by database
5. **Broadcast to Room**:
   ```javascript
   io.to(chatId).emit("receive_message", { ... })
   ```
   - `io.to(chatId)` targets all sockets in the chat room
   - Emits `receive_message` event to all connected clients
   - Includes chatId, senderId, and content

#### Step 7.3: Frontend Receives Message

All clients subscribed to that chat receive:

```javascript
socket.on("receive_message", (data) => {
  setMessages(prev => [...prev, {
    id: data.id,
    senderId: data.senderId,
    content: data.content,
    createdAt: data.createdAt
  }]);
});
```

**What happens:**
- Message is added to local state
- React re-renders and displays new message
- Appears instantly for all users in the chat
- This creates real-time chat experience

---

## Message Operations Flow

### Phase 8: Edit Message

#### Step 8.1: User Clicks Edit on Message

User clicks edit button on their message:

```javascript
const handleEditMessage = async (messageId: number, newContent: string) => {
  await editMessage(activeChat.id, messageId, newContent);
  await loadMessages(); // Refresh messages
};
```

#### Step 8.2: Send Edit Request

```typescript
export const editMessage = async (
  chatId: number,
  messageId: number,
  content: string
): Promise<Message> => {
  const res = await api.put<Message>(
    `/chats/${chatId}/messages/${messageId}`,
    { content }
  );
  return res.data;
};
```

Sends PUT request to `/chats/{chatId}/messages/{messageId}`

#### Step 8.3: Backend Validates & Updates

Routes to `messageController.editMessage`:

```javascript
export const editMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body;

  // Check message exists
  const msgCheck = await pool.query(
    "SELECT sender_id FROM messages WHERE id = $1 AND chat_id = $2",
    [messageId, chatId]
  );

  if (msgCheck.rowCount === 0) {
    return res.status(404).json({ message: "Message not found" });
  }

  // Verify user is the sender (authorization)
  if (msgCheck.rows[0].sender_id !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  // Update message
  const result = await pool.query(
    "UPDATE messages SET content = $1 WHERE id = $2 AND chat_id = $3 RETURNING id, sender_id as senderId, content, created_at",
    [content, messageId, chatId]
  );

  res.json(result.rows[0]);
};
```

**Detailed execution:**

1. **Find Message**: Queries database for message
   ```sql
   SELECT sender_id FROM messages WHERE id = $1 AND chat_id = $2
   ```
   - If not found: returns 404 error

2. **Verify Ownership**: Checks if `sender_id` matches current user
   - If different user: returns 403 (Forbidden) error
   - Prevents users from editing others' messages

3. **Update Content**:
   ```sql
   UPDATE messages SET content = $1 WHERE id = $2 AND chat_id = $3
   ```
   - Updates only the content, keeps other fields unchanged

4. **Return Updated Message**: Frontend updates its display

---

### Phase 9: Delete Message

#### Step 9.1: User Clicks Delete

```javascript
const handleDeleteMessage = async (messageId: number) => {
  await deleteMessage(activeChat.id, messageId);
  await loadMessages(); // Refresh
};
```

#### Step 9.2: Send Delete Request

```typescript
export const deleteMessage = async (
  chatId: number,
  messageId: number
): Promise<{ message: string }> => {
  const res = await api.delete<{ message: string }>(
    `/chats/${chatId}/messages/${messageId}`
  );
  return res.data;
};
```

Sends DELETE request to `/chats/{chatId}/messages/{messageId}`

#### Step 9.3: Backend Deletes Message

Routes to `messageController.deleteMessage`:

```javascript
export const deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.params;

  const msgCheck = await pool.query(
    "SELECT sender_id FROM messages WHERE id = $1 AND chat_id = $2",
    [messageId, chatId]
  );

  if (msgCheck.rowCount === 0) {
    return res.status(404).json({ message: "Message not found" });
  }

  if (msgCheck.rows[0].sender_id !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  await pool.query(
    "DELETE FROM messages WHERE id = $1 AND chat_id = $2",
    [messageId, chatId]
  );

  res.json({ message: "Message deleted" });
};
```

**Execution:**
1. Verifies message exists
2. Verifies user is sender
3. Deletes from database
4. Frontend reloads and removes message

---

## Socket.IO Communication

### Architecture Overview

Socket.IO runs on top of HTTP/WebSockets and uses event-based communication:

#### Server-side Handler Setup

When server starts, it initializes Socket.IO:

```javascript
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
```

#### Authentication Middleware

Before any events are processed:

```javascript
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error("Invalid authentication token"));
  }
});
```

**What happens:**
1. Socket handshake includes JWT token in auth
2. Token is verified using same secret as REST API
3. User ID and email are attached to socket object
4. If verification fails, connection is rejected

#### Event Flow Diagram

```
Frontend                      Backend
┌──────────────┐             ┌──────────────┐
│   Socket.IO  │             │  Socket.IO   │
│   Client     │◄───────────►│  Server      │
└──────────────┘             └──────────────┘
       │                            │
       │ socket.emit("join_chat")   │
       ├───────────────────────────►│
       │                            ├──> socket.join(roomId)
       │                            │
       │ socket.emit("send_message")│
       ├───────────────────────────►│
       │                            ├──> Save to DB
       │                            │
       │◄───────────────────────────┤
       │ io.to(room).emit()          ├──> Broadcast
       │ (receive_message)           │
       │                            │
       │ socket.on("disconnect")    │
       ├───────────────────────────►│
       │                            ├──> Cleanup
```

---

## Frontend State Management

### React Context Architecture

#### AuthContext

Manages authentication state globally:

```javascript
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Token state
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  // User state
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (jwt: string, userData: User) => {
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**How it works:**
1. On app startup, loads token and user from localStorage
2. Provides `login` and `logout` functions to all components
3. All routes can access `useAuth()` hook to get auth state
4. Protected routes check if token exists

#### SocketContext

Manages WebSocket connection:

```javascript
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token }, // Send token during handshake
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
```

**How it works:**
1. Creates Socket.IO connection only when user has token (logged in)
2. Sends JWT token during connection handshake
3. Server verifies token
4. Provides socket instance to all components
5. On logout (token removed), socket is disconnected
6. Includes auto-reconnection logic with exponential backoff

---

## Complete User Journey

### Timeline: New User Registration to First Chat

#### T=0:00 - User Opens App

1. Browser loads `localhost:5173`
2. `main.tsx` renders App wrapped with providers:
   - BrowserRouter
   - ThemeProvider
   - AuthProvider (loads token from localStorage)
   - SocketProvider (connects WebSocket)
   - App component
3. App checks AuthContext for token
4. Since no token exists, ProtectedRoute redirects to `/login`
5. Login page displays

#### T=0:30 - User Registers

1. User fills registration form:
   ```
   Email: alice@example.com
   Password: SecurePass123
   ```

2. Click "Register" → `handleSubmit` executes:
   ```javascript
   const { message } = await registerUser(name, email, password);
   ```

3. Frontend POSTs to `http://localhost:5000/auth/register`:
   ```json
   {
     "name": "Alice",
     "email": "alice@example.com",
     "password": "SecurePass123"
   }
   ```

4. Backend `authcontroller.register`:
   - Validates input
   - Checks email uniqueness
   - Hashes password with bcrypt
   - Inserts into `users` table
   - Returns success message

5. Frontend displays "Registration successful"
6. User navigates to Login page

#### T=1:00 - User Logs In

1. User enters credentials:
   ```
   Email: alice@example.com
   Password: SecurePass123
   ```

2. Click "Login" → Backend `authcontroller.login`:
   - Finds user by email
   - Compares password with bcrypt
   - Creates JWT token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Returns token

3. Frontend:
   - Stores token in localStorage
   - Calls `fetchMe()` with token in Authorization header
   - Backend returns user data
   - Calls `login(token, user)` to update AuthContext
   - Navigates to "/"

#### T=1:30 - Chat Page Loads

1. ProtectedRoute checks token → passes (token exists)
2. Chat page mounts
3. `useEffect` calls `loadChats()`
4. Frontend GETs `/chats` with JWT token
5. Backend `chatController.getChats`:
   - Queries all chats for user (where user is in chat_members)
   - Joins with other user's data
   - Returns: `[]` (empty, since no chats yet)
6. Frontend displays empty chat list

#### T=2:00 - SocketContext Establishes Connection

1. SocketProvider creates Socket.IO connection:
   ```javascript
   const socket = io("http://localhost:5000", {
     auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
   });
   ```

2. Backend Socket.IO middleware:
   - Extracts token from handshake
   - Verifies JWT
   - Sets `socket.user = { id: 1, email: "alice@example.com" }`
   - Accepts connection

3. Backend logs:
   ```
   Socket connected: /cxxxxxxxx User: 1
   ```

4. Frontend SocketContext provides socket to all components

#### T=2:30 - User Creates New Chat

1. Click "+ New Chat" button
2. Modal shows list of users (fetched via `fetchUsers()`)
3. User sees "Bob" in list
4. Click "Bob" → `createChat(2)` (Bob's user ID)
5. Frontend POSTs to `/chats`:
   ```json
   { "otherUserId": 2 }
   ```

6. Backend `chatController.createChat`:
   - Checks if chat exists between users (doesn't exist)
   - Inserts into `chats` table → chatId = 5
   - Inserts into `chat_members` twice:
     - (chat_id: 5, user_id: 1) ← Alice
     - (chat_id: 5, user_id: 2) ← Bob
   - Returns `{ chatId: 5 }`

7. Frontend:
   - Calls `loadChats()` to refresh
   - Finds new chat in list
   - Sets it as active chat
   - Closes modal

#### T=3:00 - Chat Window Opens

1. `ChatWindow` component mounts with `activeChat`
2. Emits Socket.IO event:
   ```javascript
   socket.emit("join_chat", 5);
   ```

3. Backend Socket.IO handler:
   ```javascript
   socket.on("join_chat", (chatId) => {
     socket.join("5"); // Join room named "5"
     console.log("User 1 joined chat 5");
   });
   ```

4. Frontend loads existing messages:
   ```javascript
   const messages = await fetchMessages(5);
   ```
   - Backend returns `[]` (no messages yet)
   - ChatWindow displays empty message list

#### T=3:30 - User Sends First Message

1. User types: "Hi Bob, how are you?"
2. Clicks Send → Emits via Socket.IO:
   ```javascript
   socket.emit("send_message", {
     chatId: 5,
     content: "Hi Bob, how are you?"
   });
   ```

3. Backend Socket.IO handler `send_message`:
   - Extracts: chatId=5, content="Hi Bob, how are you?"
   - Gets: senderId=1 (from socket.user)
   - Saves to database:
     ```sql
     INSERT INTO messages (chat_id, sender_id, content) 
     VALUES (5, 1, 'Hi Bob, how are you?')
     ```
   - Broadcasts to room "5":
     ```javascript
     io.to("5").emit("receive_message", {
       chatId: 5,
       senderId: 1,
       content: "Hi Bob, how are you?"
     });
     ```

4. Frontend Socket.IO listener:
   ```javascript
   socket.on("receive_message", (data) => {
     setMessages(prev => [...prev, data]);
   });
   ```
   - Adds message to state
   - ChatWindow re-renders and displays message

5. If Bob is also connected:
   - Bob's socket is in room "5"
   - Bob receives message instantly
   - Bob's ChatWindow displays: "Alice: Hi Bob, how are you?"

#### T=4:00 - User Logs Out

1. User clicks "Logout" button
2. `handleLogout` executes:
   ```javascript
   logout(); // Clear token/user from state & localStorage
   socket.disconnect(); // Close Socket.IO connection
   navigate("/login"); // Redirect to login
   ```

3. Backend Socket.IO detects disconnection:
   ```javascript
   socket.on("disconnect", () => {
     console.log("Socket disconnected:", socket.id, "User:", 1);
   });
   ```

4. Browser redirects to login page
5. ProtectedRoute checks: no token → shows login page

---

## Summary

This detailed workflow covers:

1. **Server Startup**: Database connection, Express setup, Socket.IO initialization
2. **Authentication**: Registration (password hashing), Login (JWT generation), Token verification
3. **Chat Management**: Viewing chats, creating new chats, querying related data
4. **Real-time Messaging**: WebSocket connection, message sending/receiving via Socket.IO
5. **Message Operations**: Editing and deleting messages with authorization checks
6. **State Management**: React contexts for auth and socket management
7. **Complete Journey**: Timeline from app open through first message

Every function, query, and event is explained with the exact data flow and purpose.
