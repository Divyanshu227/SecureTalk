# Quick Start Guide

## Prerequisites
- Node.js (v14+)
- PostgreSQL (with a database created)
- Git

## 1. Database Setup

Create a PostgreSQL database and run these migrations:

```sql
CREATE SCHEMA IF NOT EXISTS "public";

-- Users Table
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"name" varchar(100),
	"email" varchar(100) UNIQUE NOT NULL,
	"password" varchar(100),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"public_key" text,
	"encrypted_private_key" text,
	"username" varchar(100) CONSTRAINT "users_username_key" UNIQUE,
	"require_connection" boolean DEFAULT true,
	"last_seen" timestamp
);

-- Chat Table
CREATE TABLE "chat" (
	"chatid" serial PRIMARY KEY,
	"userid1" integer REFERENCES "users"("id"),
	"userid2" integer REFERENCES "users"("id")
);

-- Messages Table
CREATE TABLE "messages" (
	"messageid" serial PRIMARY KEY,
	"chatid" integer REFERENCES "chat"("chatid"),
	"senderid" integer REFERENCES "users"("id"),
	"receiverid" integer REFERENCES "users"("id"),
	"content" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"sender_content" text,
	"status" varchar(20) DEFAULT 'sent'
);

-- Connections Table
CREATE TABLE "connections" (
	"user1" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"user2" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "connections_pkey" PRIMARY KEY("user1","user2")
);

-- Connection Requests Table
CREATE TABLE "connection_requests" (
	"id" serial PRIMARY KEY,
	"sender_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"receiver_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "connection_requests_sender_id_receiver_id_key" UNIQUE("sender_id","receiver_id")
);

-- Push Subscriptions Table
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY,
	"user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
	"endpoint" text NOT NULL,
	"auth" text NOT NULL,
	"p256dh" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE("user_id","endpoint")
);
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
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

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

### Test Features
- **Send Messages:** Have Alice and Bob chat with each other to test WebSockets.
- **Test E2EE:** Verify that message `content` in the database is encrypted, but appears normally in the app.
- **Offline Messaging:** Turn off the internet connection in the browser's DevTools, send a message (it will queue locally via Dexie.js), and reconnect to see it sync automatically.
- **Media Upload:** Test sending an image to see it uploaded encrypted to Cloudinary.
