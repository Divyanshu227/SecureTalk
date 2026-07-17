import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

// This is used for registrering users, logging in, and fetching user data.
export const register = async (req, res) => {
  try {
    const { name, username, email, password, publicKey, encryptedPrivateKey } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existingEmail = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existingEmail.rowCount > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const existingUsername = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (existingUsername.rowCount > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, username, email, password, public_key, encrypted_private_key) VALUES ($1,$2,$3,$4,$5,$6)",
      [name, username, email, hashedPassword, publicKey || null, encryptedPrivateKey || null]
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// login function to authenticate users and provide JWT tokens
export const login = async (req, res) => {
  try {
    const { email, password, publicKey } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "14d" }
    );

    res.json({ token, user: { id: user.id }, encryptedPrivateKey: user.encrypted_private_key });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// getMe function to retrieve the authenticated user's information
export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, username, email, public_key, encrypted_private_key as \"encryptedPrivateKey\", require_connection FROM users WHERE id=$1",
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    res.json(user);
  } catch (err) {
    console.error("GetMe error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// searchUsers function to find users by username or name
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    
    const searchTerm = `%${query.toLowerCase()}%`;
    const result = await pool.query(
      "SELECT id, name, username, public_key, require_connection FROM users WHERE id != $1 AND (LOWER(username) LIKE $2 OR LOWER(name) LIKE $2) ORDER BY name LIMIT 20",
      [req.user.id, searchTerm]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("SearchUsers error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const toggleRequireConnection = async (req, res) => {
  try {
    const { requireConnection } = req.body;
    await pool.query("UPDATE users SET require_connection = $1 WHERE id = $2", [requireConnection, req.user.id]);
    res.json({ message: "Privacy settings updated" });
  } catch (err) {
    console.error("Toggle connection error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const updatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ message: "Missing publicKey" });
    await pool.query("UPDATE users SET public_key = $1 WHERE id = $2", [publicKey, req.user.id]);
    res.json({ message: "Key updated" });
  } catch (err) {
    console.error("UpdatePublicKey error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const backupKey = async (req, res) => {
  try {
    const { encryptedPrivateKey } = req.body;
    if (!encryptedPrivateKey) return res.status(400).json({ message: "Missing encryptedPrivateKey" });
    await pool.query("UPDATE users SET encrypted_private_key = $1 WHERE id = $2", [encryptedPrivateKey, req.user.id]);
    res.json({ message: "Key backed up" });
  } catch (err) {
    console.error("BackupKey error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
