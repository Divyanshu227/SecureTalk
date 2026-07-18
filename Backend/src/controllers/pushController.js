import pool from '../config/db.js';

export const saveSubscription = async (req, res) => {
  const { endpoint, keys } = req.body;
  
  if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
    return res.status(400).json({ message: "Invalid subscription payload" });
  }

  try {
    const userId = req.user.id;
    
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO NOTHING`,
      [userId, endpoint, keys.auth, keys.p256dh]
    );

    res.status(201).json({ message: "Subscription saved successfully" });
  } catch (error) {
    console.error("Save subscription error:", error);
    res.status(500).json({ message: "Failed to save subscription" });
  }
};

export const removeSubscription = async (req, res) => {
  const { endpoint } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({ message: "Endpoint required" });
  }

  try {
    const userId = req.user.id;
    await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]);
    res.json({ message: "Subscription removed successfully" });
  } catch (error) {
    console.error("Remove subscription error:", error);
    res.status(500).json({ message: "Failed to remove subscription" });
  }
};
