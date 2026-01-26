import pool from "../config/db.js";

export const sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1,$2,$3) RETURNING id, chat_id, sender_id as senderId, content, created_at, updated_at",
      [chatId, req.user.id, content]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

export const getMessages = async (req, res) => {
  const { chatId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        id, 
        chat_id, 
        sender_id as senderId, 
        content, 
        created_at,
        updated_at
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [chatId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

export const editMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body;

  try {
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

    const result = await pool.query(
      "UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2 AND chat_id = $3 RETURNING id, sender_id as senderId, content, created_at, updated_at",
      [content, messageId, chatId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ message: "Failed to edit message" });
  }
};

export const deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.params;

  try {
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

    await pool.query("DELETE FROM messages WHERE id = $1 AND chat_id = $2", [
      messageId,
      chatId,
    ]);

    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};
