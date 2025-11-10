import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Get user's joined events
router.get('/:uid/joined-events', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    // Find events where user is a participant
    const events = await mongoose.connection.db.collection('events')
      .find({ 
        'participants.uid': uid,
        isActive: true 
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching joined events:', error);
    res.status(500).json({ error: 'Failed to fetch joined events' });
  }
});

export default router;