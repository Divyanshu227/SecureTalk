// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import pg from "pg";
// import pool from "./src/config/db.js";

// // load env
// // dotenv.config();

// // const { Pool } = pg;
// const app = express();

// // middleware
// app.use(express.json());
// app.use(cors());

// // postgres connection
// // const pool = new Pool({
// //   host: process.env.PG_HOST,
// //   port: Number(process.env.PG_PORT),
// //   user: process.env.PG_USER,
// //   password: String(process.env.PG_PASSWORD),
// //   database: process.env.PG_DATABASE,
// // });

// // test database
// // pool.query("SELECT 1")
// //   .then(() => console.log("✅ Postgres connected"))
// //   .catch(err => {
// //     console.error("❌ DB connection error:", err.message);
// //     process.exit(1);
// //   });

// // test route
// app.get("/", (req, res) => {
//   res.send("Backend working");
// });

// // REGISTER
// app.post("/auth/register", async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ message: "Missing fields" });
//     }

//     // check existing user
//     const existing = await pool.query(
//       "SELECT id FROM users WHERE email=$1",
//       [email]
//     );

//     if (existing.rowCount > 0) {
//       return res.status(409).json({ message: "Email already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     await pool.query(
//       "INSERT INTO users (name, email, password) VALUES ($1,$2,$3)",
//       [name, email, hashedPassword]
//     );

//     res.status(201).json({ message: "User registered successfully" });
//   } catch (err) {
//     console.error("Register error:", err.message);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // LOGIN
// app.post("/auth/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const result = await pool.query(
//       "SELECT * FROM users WHERE email=$1",
//       [email]
//     );

//     if (result.rowCount === 0) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     const user = result.rows[0];

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     const token = jwt.sign(
//       { id: user.id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     res.json({ token });
//   } catch (err) {
//     console.error("Login error:", err.message);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });


import app from "./src/app.js";
import pool from "./src/config/db.js";
import authMiddleware from "./src/middleware/authMiddleware.js";
import http from "http";
import { Server } from "socket.io";
import { initChatSocket } from "./src/socket/chatSocket.js";

// after creating io

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
initChatSocket(io);
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});