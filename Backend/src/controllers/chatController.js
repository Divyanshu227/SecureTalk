import pool from "../config/db.js";

export const createChat = async (req, res) => {
  const { otherUserId } = req.body;

  const existingChat = await pool.query(
    `
    SELECT c.id FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
    JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
    `,
    [req.user.id, otherUserId]
  );

  if (existingChat.rowCount > 0) {
    return res.json({ chatId: existingChat.rows[0].id });
  }

  const chatRes = await pool.query(
    "INSERT INTO chats DEFAULT VALUES RETURNING id"
  );

  const chatId = chatRes.rows[0].id;

  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id) VALUES ($1,$2), ($1,$3)",
    [chatId, req.user.id, otherUserId]
  );

  res.json({ chatId });
};

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
