import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

// CORS configuration - allow all origins for testing
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔧 Environment check:', {
  nodeEnv: process.env.NODE_ENV,
  hasMongoURI: !!MONGODB_URI,
  mongoURILength: MONGODB_URI ? MONGODB_URI.length : 0
});

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
  });
} else {
  console.log('⚠️  MongoDB URI not provided');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Enhanced Health check endpoint with database status
app.get('/api/health', async (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbState = mongoose.connection.readyState;
  const dbStatus = connectionStates[dbState] || 'unknown';
  
  // Test database operation if connected
  let dbOperation = 'not_tested';
  if (dbState === 1) {
    try {
      const User = await import('./models/User.js');
      const userCount = await User.default.countDocuments();
      dbOperation = `working (${userCount} users)`;
    } catch (error) {
      dbOperation = `error: ${error.message}`;
    }
  }

  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    database: {
      connection: dbStatus,
      readyState: dbState,
      operation: dbOperation
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root endpoint with database status
app.get('/', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbStatus = connectionStates[mongoose.connection.readyState] || 'unknown';
  
  res.status(200).json({ 
    message: 'Helping Hands Server API',
    version: '1.0.0',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint for database status
app.get('/api/debug/db-status', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    mongooseState: connectionStates[mongoose.connection.readyState],
    mongooseReadyState: mongoose.connection.readyState,
    mongoURIConfigured: !!process.env.MONGODB_URI,
    mongoURILength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message
  });
});

// Export for Vercel
export default app;