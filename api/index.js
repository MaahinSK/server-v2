import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('✅ MongoDB already connected');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable buffering
      maxPoolSize: 10, // Increase connection pool
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log('✅ MongoDB connection established');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    
    if (err.name === 'MongoServerSelectionError') {
      console.log('🔧 Hint: Check your MongoDB Atlas network access and connection string');
    }
    if (err.name === 'MongoParseError') {
      console.log('🔧 Hint: Check your MONGODB_URI format');
    }
    
    // Don't throw the error, just log it
    console.log('⚠️ Continuing without database connection');
  }
};

export default connectDB;