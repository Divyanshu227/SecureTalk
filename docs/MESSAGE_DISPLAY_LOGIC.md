# Message Display & Separation Logic

## Overview
Messages are **retrieved from the database and automatically separated** into sender (right) and receiver (left) based on the current user's ID.

## How It Works

### Step 1: Fetch All Messages
**File**: `chat-frontend/src/components/ChatWindow.tsx` → `loadMessages()`
**Backend API**: `GET /chats/{chatId}/messages`

```
Frontend → Backend (HTTP GET)
  ↓
Database Query (messageController.js)
  ↓
SELECT all messages for chat_id
ORDER BY created_at ASC (chronological order)
  ↓
Backend → Frontend (returns array of messages)
```

**Backend Query** (`Backend/src/controllers/messageController.js`):
```sql
SELECT 
  id, 
  chat_id, 
  sender_id as senderId,    ← Important: Each message includes who sent it
  content, 
  created_at,
  updated_at
FROM messages
WHERE chat_id = $1
ORDER BY created_at ASC, id ASC   ← Sort by timestamp, then ID
```

### Step 2: Sort Messages by Timestamp (Frontend)
**File**: `chat-frontend/src/components/ChatWindow.tsx` → `loadMessages()`

```javascript
const sortedMessages = [...data].sort((a, b) => {
  const timeA = new Date(a.created_at || 0).getTime();
  const timeB = new Date(b.created_at || 0).getTime();
  return timeA - timeB;  // Oldest first (ascending order)
});
setMessages(sortedMessages);
```

### Step 3: Render Messages with Sender/Receiver Separation
**File**: `chat-frontend/src/components/ChatWindow.tsx` → Message rendering

For each message in the array:

```javascript
messages.map((msg) => {
  // 1. Get sender ID from message
  const senderId = Number(msg.senderId);
  
  // 2. Get current logged-in user's ID
  const currentUserId = Number(user?.id);
  
  // 3. Determine if message is sent or received
  const isSent = senderId === currentUserId;
  // ↓
  // If senderId === currentUserId → User sent this message → Show on RIGHT
  // If senderId !== currentUserId → User received this message → Show on LEFT
  
  // 4. Apply appropriate CSS class
  return (
    <div className={`message ${isSent ? "sent" : "received"}`}>
      {/* Message bubble with content and timestamp */}
    </div>
  );
});
```

### Step 4: CSS Styling
**File**: `chat-frontend/src/index.css`

```css
.message {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message.sent {
  justify-content: flex-end;     ← Positions bubble on the right
}

.message.received {
  justify-content: flex-start;   ← Positions bubble on the left
}

.message.sent .message-bubble {
  background: linear-gradient(135deg, #00ff88 0%, #00d4ff 100%);  ← Green/cyan color
  color: #0a0e27;
  align-items: flex-end;
}

.message.received .message-bubble {
  background: linear-gradient(135deg, #ff006e 0%, #8338ec 100%);  ← Pink/purple color
  color: #ffffff;
  align-items: flex-start;
}
```

## Complete Flow Example

### Scenario: User A and User B chatting

**Database State:**
```
Message 1: sender_id=1, content="Hi B!", created_at=10:00
Message 2: sender_id=2, content="Hi A!", created_at=10:05
Message 3: sender_id=1, content="How are you?", created_at=10:10
Message 4: sender_id=2, content="Good!", created_at=10:15
```

### When User A opens the chat (user.id = 1):

```
1. Fetch all 4 messages from database
2. Sort by timestamp (already sorted in DB)
3. Render:

   Message 1: sender_id=1, currentUserId=1
   → senderId === currentUserId → isSent=true
   → Show on RIGHT with green color ✅

   Message 2: sender_id=2, currentUserId=1
   → senderId !== currentUserId → isSent=false
   → Show on LEFT with purple color ✅

   Message 3: sender_id=1, currentUserId=1
   → senderId === currentUserId → isSent=true
   → Show on RIGHT with green color ✅

   Message 4: sender_id=2, currentUserId=1
   → senderId !== currentUserId → isSent=false
   → Show on LEFT with purple color ✅
```

### When User B opens the same chat (user.id = 2):

```
Same database messages, but different rendering:

   Message 1: sender_id=1, currentUserId=2
   → senderId !== currentUserId → isSent=false
   → Show on LEFT (because User A sent it) ✅

   Message 2: sender_id=2, currentUserId=2
   → senderId === currentUserId → isSent=true
   → Show on RIGHT (because User B sent it) ✅

   Message 3: sender_id=1, currentUserId=2
   → senderId !== currentUserId → isSent=false
   → Show on LEFT (because User A sent it) ✅

   Message 4: sender_id=2, currentUserId=2
   → senderId === currentUserId → isSent=true
   → Show on RIGHT (because User B sent it) ✅
```

## Key Points

✅ **All messages are retrieved** - No filtering, all messages for the chat are loaded
✅ **Chronological order** - Sorted by `created_at` timestamp (oldest first)
✅ **Automatic separation** - Uses `senderId === currentUserId` comparison
✅ **Visual distinction** - Different colors and positioning for sent vs received
✅ **Edit/Delete only own** - Only show edit/delete buttons for `isSent === true`

## Debugging

To verify the logic is working correctly, check the browser console:

```
Message 1: Sender=1, CurrentUser=1, IsSent=true, Content="Hi B!..."
Message 2: Sender=2, CurrentUser=1, IsSent=false, Content="Hi A!..."
Message 3: Sender=1, CurrentUser=1, IsSent=true, Content="How are you?..."
Message 4: Sender=2, CurrentUser=1, IsSent=false, Content="Good!..."
```

If messages are all on one side, the `senderId` comparison is failing. This means either:
1. The backend is not returning `sender_id` correctly
2. The `user?.id` is not set correctly
3. Type mismatch (string vs number) - check the `Number()` conversion
