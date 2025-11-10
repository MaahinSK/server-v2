import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Sync user data from Firebase to MongoDB
router.post('/sync-user', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;

    if (!uid || !email || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find existing user or create new one
    let user = await User.findOne({ uid });
    
    if (user) {
      // Update existing user
      user.email = email;
      user.displayName = displayName;
      user.photoURL = photoURL || user.photoURL;
      user.updatedAt = new Date();
    } else {
      // Create new user
      user = new User({
        uid,
        email,
        displayName,
        photoURL: photoURL || ''
      });
    }

    await user.save();

    res.status(200).json({
      message: 'User synced successfully',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const user = await User.findOne({ uid })
      .populate('joinedEvents', 'title eventDate location')
      .select('-__v');

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