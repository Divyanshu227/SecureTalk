import pool from "../config/db.js";

// Send a connection request
export const sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    
    if (receiverId === req.user.id) {
      return res.status(400).json({ message: "Cannot send request to yourself" });
    }

    // Check if already connected
    const existingConn = await pool.query(
      "SELECT 1 FROM connections WHERE (user1=$1 AND user2=$2) OR (user1=$2 AND user2=$1)",
      [req.user.id, receiverId]
    );

    if (existingConn.rowCount > 0) {
      return res.status(409).json({ message: "Already connected" });
    }

    // Check if request already exists
    const existingReq = await pool.query(
      "SELECT status FROM connection_requests WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)",
      [req.user.id, receiverId]
    );

    if (existingReq.rowCount > 0) {
      return res.status(409).json({ message: "Connection request already exists" });
    }

    await pool.query(
      "INSERT INTO connection_requests (sender_id, receiver_id) VALUES ($1, $2)",
      [req.user.id, receiverId]
    );

    res.status(201).json({ message: "Connection request sent" });
  } catch (err) {
    console.error("sendRequest error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a request (accept or reject)
export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const requestRes = await pool.query(
      "SELECT * FROM connection_requests WHERE id=$1 AND receiver_id=$2 AND status='pending'",
      [id, req.user.id]
    );

    if (requestRes.rowCount === 0) {
      return res.status(404).json({ message: "Request not found or already processed" });
    }

    const request = requestRes.rows[0];

    // Update status
    await pool.query("UPDATE connection_requests SET status=$1 WHERE id=$2", [status, id]);

    if (status === 'accepted') {
      const user1 = Math.min(request.sender_id, request.receiver_id);
      const user2 = Math.max(request.sender_id, request.receiver_id);
      
      await pool.query(
        "INSERT INTO connections (user1, user2) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [user1, user2]
      );
    }

    res.json({ message: `Request ${status}` });
  } catch (err) {
    console.error("updateRequest error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get pending incoming requests
export const getPendingRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cr.id, u.id as sender_id, u.name as sender_name, u.username as sender_username, u.public_key as sender_public_key, cr.created_at
       FROM connection_requests cr
       JOIN users u ON cr.sender_id = u.id
       WHERE cr.receiver_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("getPendingRequests error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Check connection status with a specific user
export const getConnectionStatus = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    
    // Check if connected
    const conn = await pool.query(
      "SELECT 1 FROM connections WHERE (user1=$1 AND user2=$2) OR (user1=$2 AND user2=$1)",
      [req.user.id, otherUserId]
    );
    if (conn.rowCount > 0) {
      return res.json({ status: 'connected' });
    }

    // Check pending requests
    const reqOut = await pool.query(
      "SELECT 1 FROM connection_requests WHERE sender_id=$1 AND receiver_id=$2 AND status='pending'",
      [req.user.id, otherUserId]
    );
    if (reqOut.rowCount > 0) {
      return res.json({ status: 'pending_sent' });
    }

    const reqIn = await pool.query(
      "SELECT id FROM connection_requests WHERE sender_id=$1 AND receiver_id=$2 AND status='pending'",
      [otherUserId, req.user.id]
    );
    if (reqIn.rowCount > 0) {
      return res.json({ status: 'pending_received', requestId: reqIn.rows[0].id });
    }

    res.json({ status: 'none' });
  } catch (err) {
    console.error("getConnectionStatus error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
