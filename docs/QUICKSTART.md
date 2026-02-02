# Quick Start Guide

## Prerequisites
- Node.js (v14+)
- PostgreSQL (with a database created)
- Git

## 1. Database Setup

Create a PostgreSQL database and run these migrations:

```sql
-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chats Table
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Members Table
CREATE TABLE chat_members (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, user_id)
);

-- Messages Table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_users_email ON users(email);
```

## 2. Backend Setup

```bash
# Navigate to backend directory
cd Backend

# Install dependencies
npm install

# Create .env file with these variables:
# DATABASE_URL=postgresql://user:password@localhost:5432/chatapp
# JWT_SECRET=your_secret_key_here
# PORT=5000

# Start the server
npm run dev
```

Backend will run on: `http://localhost:5000`

## 3. Frontend Setup

```bash
# Navigate to frontend directory
cd chat-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on: `http://localhost:5173`

## 4. Testing the Application

### Create Test Users
1. Register User 1:
   - Name: Alice
   - Email: alice@example.com
   - Password: password123

2. Register User 2:
   - Name: Bob
   - Email: bob@example.com
   - Password: password123

### Test Chat Flow
1. Log in as Alice
2. Click "+ New Chat"
3. Select Bob from the user list
4. Type a message: "Hello Bob!"
5. Press Enter or click Send
6. Click Edit button to modify message
7. Click Delete button to remove message
8. Open new browser tab/window for Bob
9. Log in as Bob
10. See conversation with Alice
11. Send a reply message

## Project Structure

```
Chatapp/
├── Backend/
│   ├── src/
│   │   ├── app.js                 # Express app setup
│   │   ├── server.js              # Server entry point
│   │   ├── config/
│   │   │   └── db.js             # Database connection
│   │   ├── controllers/
│   │   │   ├── authcontroller.js
│   │   │   ├── chatController.js
│   │   │   └── messageController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── routes/
│   │   │   ├── authroutes.js
│   │   │   ├── chatroutes.js
│   │   │   └── messageroutes.js
│   │   └── socket/
│   └── package.json
│
├── chat-frontend/
│   ├── src/
│   │   ├── App.tsx               # Main app component
│   │   ├── main.tsx              # Entry point
│   │   ├── index.css             # Global styles
│   │   ├── api/
│   │   │   ├── auth.ts
│   │   │   ├── chat.ts
│   │   │   ├── message.ts
│   │   │   └── axios.ts
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── components/
│   │   │   ├── ChatList.tsx
│   │   │   └── ChatWindow.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Chat.tsx
│   │   └── types/
│   │       ├── index.ts
│   │       ├── auth.ts
│   │       ├── chat.ts
│   │       ├── message.ts
│   │       └── User.ts
│   └── package.json
│
└── PROJECT_SUMMARY.md
```

## Available Scripts

### Backend
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in .env file
- Ensure database exists

### Port Already in Use
- Change PORT in .env file
- Or kill process using the port

### CORS Errors
- Ensure backend CORS is enabled
- Check API base URL in axios.ts

### Login Fails
- Verify user credentials are correct
- Check backend is running
- Check network tab in DevTools

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/chatapp
JWT_SECRET=your-secret-key-make-this-long-and-secure
PORT=5000
NODE_ENV=development
```

### Frontend
- No .env needed, API URL configured in axios.ts
- Default: http://localhost:5000

## Performance Tips

1. **Database Indexes**: Already created for common queries
2. **Message Pagination**: Consider limiting message loads
3. **Image Optimization**: If adding images, optimize sizes
4. **Caching**: Implement browser caching headers

## Security Checklist

- ✅ Passwords hashed with bcrypt
- ✅ JWT token validation on protected routes
- ✅ CORS enabled but should be restricted to frontend URL
- ✅ SQL injection prevention with parameterized queries
- ✅ XSS protection with React's built-in escaping
- ⚠️ TODO: Add rate limiting for API endpoints
- ⚠️ TODO: Add HTTPS in production
- ⚠️ TODO: Add more comprehensive input validation

## Next Steps

After getting the basic app running, consider:

1. **Add Socket.io** for real-time messaging
2. **Implement Groups** for multiple user chats
3. **Add Typing Indicators** to show when users are typing
4. **Message Reactions** with emojis
5. **File Sharing** capability
6. **User Profiles** with images
7. **Push Notifications** for new messages
8. **Dark Mode** toggle
9. **Search Messages** functionality
10. **Block Users** feature

## Support

For issues:
1. Check console for error messages
2. Check network tab in browser DevTools
3. Verify all services are running
4. Check database connection
5. Review error logs in terminal
