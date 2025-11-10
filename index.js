import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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

// MongoDB connection setup
const MONGODB_URI = process.env.MONGODB_URI;

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    console.log('🔄 Using cached database connection');
    return cachedDb;
  }

  console.log('🔄 Creating new database connection...');
  
  try {
    // Close any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const connection = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      bufferMaxEntries: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    cachedDb = connection;
    console.log('✅ New database connection established');
    return connection;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

// Middleware to handle database connection for each request
app.use(async (req, res, next) => {
  try {
    if (MONGODB_URI) {
      await connectToDatabase();
    }
    next();
  } catch (error) {
    console.error('Database connection middleware error:', error.message);
    next(); // Continue without database
  }
});

// Import routes
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import userRoutes from './routes/users.js';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
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
      mongoURIConfigured: !!MONGODB_URI,
      usingCached: !!cachedDb
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test database operations
app.get('/api/test-db', async (req, res) => {
  try {
    if (!MONGODB_URI) {
      return res.status(503).json({ 
        error: 'MongoDB URI not configured'
      });
    }

    await connectToDatabase();

    // Test insert
    const testDoc = {
      test: true,
      message: 'Database test from Vercel Serverless',
      timestamp: new Date(),
      environment: process.env.NODE_ENV
    };
    
    const result = await mongoose.connection.db.collection('vercelTests').insertOne(testDoc);
    
    res.json({
      success: true,
      message: 'Database test successful',
      insertedId: result.insertedId,
      database: mongoose.connection.db.databaseName,
      readyState: mongoose.connection.readyState
    });
    
  } catch (error) {
    console.error('Database test error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Database test failed',
      message: error.message,
      readyState: mongoose.connection.readyState
    });
  }
});

// Enhanced connection test
app.get('/api/debug/connection', async (req, res) => {
  try {
    if (!MONGODB_URI) {
      return res.json({
        status: 'error',
        message: 'MONGODB_URI not configured in environment variables'
      });
    }

    console.log('Testing MongoDB connection with URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
    // Test raw connection
    const connection = await mongoose.createConnection(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000
    }).asPromise();

    // Test operation
    const testDoc = { debug: true, time: new Date() };
    const result = await connection.db.collection('debugTests').insertOne(testDoc);

    await connection.close();

    res.json({
      status: 'success',
      message: 'MongoDB connection successful',
      insertedId: result.insertedId,
      database: connection.db.databaseName
    });

  } catch (error) {
    console.error('Debug connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'MongoDB connection failed',
      error: error.message,
      code: error.code,
      name: error.name
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Helping Hands Server API',
    version: '1.0.0',
    serverless: true,
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
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// Export for Vercel
export default app;