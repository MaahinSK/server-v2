import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Get all events with filtering
router.get('/', async (req, res) => {
  try {
    const { type, search, page = 1, limit = 12 } = req.query;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    // Build filter
    const filter = { isActive: true };
    if (type) filter.eventType = type;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get events
    const events = await mongoose.connection.db.collection('events')
      .find(filter)
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await mongoose.connection.db.collection('events').countDocuments(filter);

    res.json({
      events,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const event = await mongoose.connection.db.collection('events').findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      isActive: true 
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);

  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const { title, description, eventType, thumbnail, location, eventDate, creator, maxParticipants = 0 } = req.body;
    
    console.log('Creating event:', title);

    // REMOVE thumbnail from required fields
    if (!title || !description || !eventType || !location || !eventDate || !creator) {
      return res.status(400).json({ error: 'All fields except thumbnail are required' });
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const eventData = {
      title,
      description,
      eventType,
      thumbnail: thumbnail || '', // Set to empty string if not provided
      location,
      eventDate: new Date(eventDate),
      creator: {
        uid: creator.uid,
        email: creator.email,
        displayName: creator.displayName,
        photoURL: creator.photoURL || ''
      },
      participants: [],
      maxParticipants: parseInt(maxParticipants),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await mongoose.connection.db.collection('events').insertOne(eventData);

    res.status(201).json({
      message: 'Event created successfully',
      event: { ...eventData, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event: ' + error.message });
  }
});

// Update event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const event = await mongoose.connection.db.collection('events').findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.creator.uid !== updateData.creator?.uid) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const allowedUpdates = ['title', 'description', 'eventType', 'thumbnail', 'location', 'eventDate', 'maxParticipants'];
    const updateFields = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields[field] = field === 'eventDate' ? new Date(updateData[field]) : updateData[field];
      }
    });

    updateFields.updatedAt = new Date();

    await mongoose.connection.db.collection('events').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields }
    );

    res.json({
      message: 'Event updated successfully',
      event: { ...event, ...updateFields }
    });

  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Join event
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.body;

    if (!user || !user.uid) {
      return res.status(400).json({ error: 'User data is required' });
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const event = await mongoose.connection.db.collection('events').findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      isActive: true 
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if already joined
    const isAlreadyJoined = event.participants.some(p => p.uid === user.uid);
    if (isAlreadyJoined) {
      return res.status(400).json({ error: 'Already joined this event' });
    }

    // Add participant
    await mongoose.connection.db.collection('events').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $push: { 
          participants: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL || '',
            joinedAt: new Date()
          }
        },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ message: 'Successfully joined the event' });

  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// Get user's created events
router.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const events = await mongoose.connection.db.collection('events')
      .find({ 
        'creator.uid': uid,
        isActive: true 
      })
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await mongoose.connection.db.collection('events').countDocuments({ 
      'creator.uid': uid,
      isActive: true 
    });

    res.json({
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

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔄 Updating event:', id, 'with data:', updateData);

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
    }

    // Find the event first
    const event = await mongoose.connection.db.collection('events').findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is the event creator
    if (event.creator.uid !== updateData.creator?.uid) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    // Prepare update fields
    const updateFields = {
      title: updateData.title,
      description: updateData.description,
      eventType: updateData.eventType,
      thumbnail: updateData.thumbnail || '',
      location: updateData.location,
      eventDate: new Date(updateData.eventDate),
      maxParticipants: parseInt(updateData.maxParticipants) || 0,
      updatedAt: new Date()
    };

    // Update the event
    const result = await mongoose.connection.db.collection('events').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields }
    );

    console.log('✅ Event updated successfully:', result);

    // Get the updated event
    const updatedEvent = await mongoose.connection.db.collection('events').findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    res.json({
      message: 'Event updated successfully',
      event: updatedEvent
    });

  } catch (error) {
    console.error('❌ Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event: ' + error.message });
  }
});

export default router;