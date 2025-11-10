import express from 'express';
import Event from '../models/Event.js';
import User from '../models/User.js';

const router = express.Router();

// Get all events with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      type, 
      search, 
      page = 1, 
      limit = 12,
      sort = 'eventDate'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (type) {
      filter.eventType = type;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get events with pagination
    const events = await Event.find(filter)
      .sort({ [sort]: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Event.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      events,
      total,
      currentPage: pageNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.isActive) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.status(200).json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create new event
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
      creator,
      maxParticipants = 0
    } = req.body;

    // Validation
    if (!title || !description || !eventType || !thumbnail || !location || !eventDate || !creator) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if event date is in the future
    if (new Date(eventDate) <= new Date()) {
      return res.status(400).json({ error: 'Event date must be in the future' });
    }

    const event = new Event({
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate: new Date(eventDate),
      creator: {
        uid: creator.uid,
        email: creator.email,
        displayName: creator.displayName,
        photoURL: creator.photoURL || ''
      },
      maxParticipants: parseInt(maxParticipants),
      participants: []
    });

    await event.save();

    res.status(201).json({
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid event data' });
    }
    
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is the event creator
    if (event.creator.uid !== updateData.creator?.uid) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'eventType', 'thumbnail', 'location', 'eventDate', 'maxParticipants'];
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        event[field] = field === 'eventDate' ? new Date(updateData[field]) : updateData[field];
      }
    });

    await event.save();

    res.status(200).json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Error updating event:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid event data' });
    }
    
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Join event
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    if (!user || !user.uid) {
      return res.status(400).json({ error: 'User data is required' });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.isActive) {
      return res.status(400).json({ error: 'Event is no longer active' });
    }

    // Check if event has already passed
    if (new Date(event.eventDate) <= new Date()) {
      return res.status(400).json({ error: 'Event has already occurred' });
    }

    // Check if user is already a participant
    const isAlreadyJoined = event.participants.some(
      participant => participant.uid === user.uid
    );

    if (isAlreadyJoined) {
      return res.status(400).json({ error: 'Already joined this event' });
    }

    // Check participant limit
    if (event.maxParticipants > 0 && event.participants.length >= event.maxParticipants) {
      return res.status(400).json({ error: 'Event is full' });
    }

    // Add user to participants
    event.participants.push({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL || ''
    });

    await event.save();

    // Add event to user's joinedEvents
    await User.findOneAndUpdate(
      { uid: user.uid },
      { $addToSet: { joinedEvents: event._id } },
      { new: true }
    );

    res.status(200).json({
      message: 'Successfully joined the event',
      event
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// Get events created by a specific user
router.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const events = await Event.find({ 'creator.uid': uid, isActive: true })
      .sort({ eventDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Event.countDocuments({ 'creator.uid': uid, isActive: true });

    res.status(200).json({
      events,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch user events' });
  }
});

export default router;