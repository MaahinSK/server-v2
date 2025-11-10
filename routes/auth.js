import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Sync user data from Firebase to MongoDB
router.post('/sync-user', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    
    console.log('📥 Sync user request received:', { uid, email, displayName });

    // Validate required fields
    if (!uid || !email || !displayName) {
      return res.status(400).json({ 
        error: 'Missing required fields: uid, email, displayName' 
      });
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ 
        error: 'Server configuration error: MONGODB_URI not set' 
      });
    }

    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState !== 1) {
      console.log('🔄 Connecting to MongoDB...');
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ MongoDB connected for user sync');
    }

    // Prepare user data
    const userData = {
      uid: uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL || '',
      updatedAt: new Date()
    };

    console.log('💾 Saving user data to MongoDB...');

    // Use updateOne with upsert to create or update user
    const result = await mongoose.connection.db.collection('users').updateOne(
      { uid: uid },
      { 
        $set: userData,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    console.log('✅ User saved successfully:', result);

    res.status(200).json({
      message: 'User synced successfully',
      user: userData,
      action: result.upsertedCount > 0 ? 'created' : 'updated'
    });

  } catch (error) {
    console.error('❌ Error in sync-user:', error);
    res.status(500).json({ 
      error: 'Failed to sync user',
      details: error.message 
    });
  }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
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
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;