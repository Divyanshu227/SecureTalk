import express from 'express';
import { saveSubscription, removeSubscription } from '../controllers/pushController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/subscribe', saveSubscription);
router.post('/unsubscribe', removeSubscription);
router.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

export default router;
