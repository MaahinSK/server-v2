import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  photoURL: {
    type: String,
    default: ''
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  eventType: {
    type: String,
    required: true,
    enum: ['Cleanup', 'Plantation', 'Donation', 'Education', 'Healthcare', 'Other']
  },
  thumbnail: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  eventDate: {
    type: Date,
    required: true
  },
  creator: {
    uid: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true
    },
    photoURL: {
      type: String,
      default: ''
    }
  },
  participants: [participantSchema],
  maxParticipants: {
    type: Number,
    default: 0 // 0 means no limit
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
eventSchema.index({ eventDate: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ 'creator.uid': 1 });
eventSchema.index({ 'participants.uid': 1 });

export default mongoose.model('Event', eventSchema);