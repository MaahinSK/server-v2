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
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection - Use direct connection string for now
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://maahin810:2NwOhLuR2Kt2ncL4@cluster0.xnczrsy.mongodb.net/helping-hands?retryWrites=true&w=majority';

console.log('🔧 MongoDB Configuration:');
console.log('   - Using MONGODB_URI from env:', !!process.env.MONGODB_URI);
console.log('   - Environment:', process.env.NODE_ENV);

// Connect to MongoDB
async function connectDB() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully!');
    console.log('   - Database:', mongoose.connection.db.databaseName);
    console.log('   - Host:', mongoose.connection.host);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   - Error:', error.message);
    console.error('   - Code:', error.code);
    
    // Don't exit the process in Vercel environment
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

// Start database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbState = mongoose.connection.readyState;
  const dbStatus = connectionStates[dbState] || 'unknown';
  
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    database: {
      connection: dbStatus,
      readyState: dbState,
      mongoURIConfigured: !!process.env.MONGODB_URI,
      usingFallback: !process.env.MONGODB_URI
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test database operations
app.get('/api/test-db', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database not connected',
        readyState: mongoose.connection.readyState 
      });
    }

    // Test insert
    const testDoc = {
      test: true,
      message: 'Database test from Vercel',
      timestamp: new Date(),
      environment: process.env.NODE_ENV
    };
    
    const result = await mongoose.connection.db.collection('vercelTests').insertOne(testDoc);
    
    res.json({
      success: true,
      message: 'Database test successful',
      insertedId: result.insertedId,
      database: mongoose.connection.db.databaseName,
      connection: 'active'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database test failed',
      message: error.message,
      readyState: mongoose.connection.readyState
    });
  }
});

// Root endpoint
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