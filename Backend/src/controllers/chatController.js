import pool from "../config/db.js";
// This is used for creating chats and fetching chat data.
export const createChat = async (req, res) => {
  const { otherUserId } = req.body;

  const existingChat = await pool.query(
    // Check if a chat already exists between the two users
    `
    SELECT chatid from chat where ((userid1=$1 and userid2=$2) or (userid1 =$2 and userid2=$1))
    `,
    [req.user.id, otherUserId]
  );

  if (existingChat.rowCount > 0) {
    return res.json({ chatId: existingChat.rows[0].chatid });
  }

  const chatRes = await pool.query(
    "INSERT INTO chat (userid1, userid2) VALUES ($1, $2) RETURNING chatid",
    [req.user.id, otherUserId]
  );

  const chatId = chatRes.rows[0].chatid;
  // Add both users to the chat_members table
  // await pool.query(
  //   "INSERT INTO chat_members (chat_id, user_id) VALUES ($1,$2), ($1,$3)",
  //   [chatId, req.user.id, otherUserId]
  // );

  res.json({ chatId });
};
// this fetches all chats for the authenticated user along with the last message and other user's info
export const getChats = async (req, res) => {
  const result = await pool.query(
    `select chatid as id,
    (select content from messages where chatid = c.chatid order by created_at desc limit 1) as last_message,
    (select created_at from messages where chatid = c.chatid order by created_at desc limit 1) as last_message_time,
    u.id as other_user_id,
    u.name as other_user_name,
    u.email as other_user_email,
    u.public_key as other_user_public_key
    from chat c
    join users u on (c.userid1 = u.id and c.userid2 = $1) or (c.userid2 = u.id and c.userid1 = $1)
    where c.userid1 = $1 or c.userid2 = $1
    order by last_message_time desc nulls last`,
    [req.user.id]
    // `
    // SELECT c.id, 
    //        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
    //        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_time,
    //        u.id as other_user_id,
    //        u.name as other_user_name,
    //        u.email as other_user_email
    // FROM chats c
    // JOIN chat_members cm ON c.id = cm.chat_id
    // JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id != $1
    // JOIN users u ON cm2.user_id = u.id
    // WHERE cm.user_id = $1
    // ORDER BY (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    // `,
    // [req.user.id]

  );
  // explanation: This query retrieves all chats for the authenticated user (req.user.id). It joins the chats with chat_members to find chats involving the user and fetches the other user's details. It also retrieves the last message and its timestamp for each chat, ordering the results by the most recent message.
  const chats = result.rows.map(row => ({
    id: row.id,
    lastMessage: row.last_message,
    lastMessageTime: row.last_message_time,
    otherUser: {
      id: row.other_user_id,
      name: row.other_user_name,
      email: row.other_user_email,
      public_key: row.other_user_public_key
    }
  }));

  res.json(chats);
};
