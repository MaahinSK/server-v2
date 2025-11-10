import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Sync user data from Firebase to MongoDB
router.post('/sync-user', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    
    console.log('📥 Sync user request:', { uid, email });

    if (!uid || !email || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    // User data
    const userData = {
      uid: uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL || '',
      updatedAt: new Date()
    };

    // Upsert user
    const result = await mongoose.connection.db.collection('users').updateOne(
      { uid: uid },
      { 
        $set: userData,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    res.status(200).json({
      message: 'User synced successfully',
      user: userData,
      action: result.upsertedCount > 0 ? 'created' : 'updated'
    });

  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ 
      error: 'Failed to sync user',
      details: error.message 
    });
  }
});

// Get user profile
router.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const user = await mongoose.connection.db.collection('users').findOne({ uid });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;