import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// FIX: Add trust proxy for Vercel
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI;

// Simple connection
async function connectDB() {
  if (mongoose.connection.readyState !== 1 && MONGODB_URI) {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  }
}

// Import and use routes
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js'; 
import userRoutes from './routes/users.js';

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  await connectDB();
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    await connectDB();
    const result = await mongoose.connection.db.collection('tests').insertOne({ 
      test: true, 
      time: new Date(),
      message: 'API test successful'
    });
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Test failed: ' + error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Helping Hands API', status: 'running' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;