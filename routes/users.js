import express from 'express';
import User from '../models/User.js';
import Event from '../models/Event.js';

const router = express.Router();

// Get user's joined events
router.get('/:uid/joined-events', async (req, res) => {
  try {
    const { uid } = req.params;

    // First, get the user to populate joinedEvents
    const user = await User.findOne({ uid }).populate({
      path: 'joinedEvents',
      match: { isActive: true },
      options: { sort: { eventDate: 1 } }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user.joinedEvents || []);
  } catch (error) {
    console.error('Error fetching joined events:', error);
    res.status(500).json({ error: 'Failed to fetch joined events' });
  }
});

// Leave an event
router.delete('/:uid/events/:eventId', async (req, res) => {
  try {
    const { uid, eventId } = req.params;

    // Remove from event participants
    const event = await Event.findById(eventId);
    if (event) {
      event.participants = event.participants.filter(
        participant => participant.uid !== uid
      );
      await event.save();
    }

    // Remove from user's joinedEvents
    await User.findOneAndUpdate(
      { uid },
      { $pull: { joinedEvents: eventId } }
    );

    res.status(200).json({ message: 'Successfully left the event' });
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
});

export default router;