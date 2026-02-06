import pool from "../config/db.js";
// This is used for sending, fetching, editing, and deleting messages.
export const sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;
// explanation: This function handles sending a new message in a specific chat. It inserts the message into the messages table with the chat ID, sender ID (from the authenticated user), and content.
  try {
    console.log(chatId, req.user.id, content);

    // Fetch chat participants so we can determine the receiver
    const chatRes = await pool.query(
      "SELECT userid1, userid2 FROM chat WHERE chatid = $1",
      [chatId]
    );

    if (chatRes.rowCount === 0) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const { userid1, userid2 } = chatRes.rows[0];
    if (req.user.id !== userid1 && req.user.id !== userid2) {
      return res.status(403).json({ message: "User not in this chat" });
    }

    const receiverId = req.user.id === userid1 ? userid2 : userid1;

    const insertRes = await pool.query(
      "INSERT INTO messages (chatid, senderid,receiverid, content) VALUES ($1,$2,$3,$4) RETURNING messageid, chatid as chat_id, senderid as senderId, content, created_at",
      [chatId, req.user.id, receiverId, content]
    );

    const inserted = insertRes.rows[0];
    // Augment response with computed receiverId and isSent flag
    res.json({
      id: inserted.messageid,
      chatId: inserted.chat_id,
      senderId: inserted.senderId,
      receiverId,
      content: inserted.content,
      created_at: inserted.created_at,
      isSent: true,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};
// explanation: This function retrieves all messages for a specific chat, marking each message as sent or received based on the authenticated user's ID.
export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.id;
  const othersUserId = req.query.otherUserId; 
  console.log("chatId:", chatId, typeof chatId);
console.log("currentUserId:", currentUserId, typeof currentUserId);
console.log("req.user:", req.user);
// Optional: can be used for additional validation if needed
  try {
    const result = await pool.query(
      // `
      // SELECT 
      //   m.id,
      //   m.chat_id,
      //   m.sender_id as senderId,
      //   -- compute receiver based on chat participants
      //   CASE WHEN m.sender_id = c.userid1 THEN c.userid2 ELSE c.userid1 END as receiverId,
      //   m.content,
      //   m.created_at,
      //   m.updated_at,
      //   CASE WHEN m.sender_id = $2 THEN true ELSE false END as isSent
      // FROM messages m
      // JOIN chat c ON m.chat_id = c.chatid
      // WHERE m.chat_id = $1
      // ORDER BY m.created_at ASC, m.id ASC
      // `,
      // [chatId, currentUserId]
    `SELECT m.messageid,
            m.chatid as chat_id,
            m.senderid as senderId,
            CASE WHEN m.senderid = $2 THEN true ELSE false END as isSent,
            m.content,
            m.created_at
      FROM messages m
      WHERE m.chatid = $1
      ORDER BY m.created_at ASC, m.messageid ASC`,
      [chatId, currentUserId]
    );
    console.log("Raw DB result:", result.rows);
    console.log(`📨 Retrieved ${result.rows.length} messages for chat ${chatId}`);
    result.rows.forEach(msg => {
      console.log(`   - Message ${msg.messageid}: ${msg.issent ? "SENT" : "RECEIVED"}, Content="${msg.content.substring(0, 30)}..."`);
    });

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

    // const result = await pool.query(
    //   "UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2 AND chat_id = $3 RETURNING id, sender_id as senderId, content, created_at, updated_at",
    //   [content, messageId, chatId]
    // );

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
