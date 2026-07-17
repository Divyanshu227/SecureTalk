import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
// This is used for registrering users, logging in, and fetching user data.
export const register = async (req, res) => {
  try {
    const { name, email, password, publicKey } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password, public_key) VALUES ($1,$2,$3,$4)",
      [name, email, hashedPassword, publicKey || null]
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

    // Update public key if provided on login (new device)
    if (publicKey && publicKey !== user.public_key) {
      await pool.query("UPDATE users SET public_key = $1 WHERE id = $2", [publicKey, user.id]);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "14d" }
    );

    res.json({ token, user: { id: user.id } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
// getMe function to retrieve the authenticated user's information
export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, public_key FROM users WHERE id=$1",
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
// getAllUsers function to fetch a list of all users except the authenticated user
export const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, public_key FROM users WHERE id != $1 ORDER BY name",
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GetAllUsers error:", err.message);
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
