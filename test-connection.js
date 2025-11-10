import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://maahin810:2NwOhLuR2Kt2ncL4@cluster0.xnczrsy.mongodb.net/helping-hands?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('🔧 Testing MongoDB connection...');
    console.log('URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('✅ MongoDB connected successfully!');
    console.log('Database:', mongoose.connection.db.databaseName);
    
    // Test a simple operation
    const result = await mongoose.connection.db.collection('test').insertOne({
      test: true,
      timestamp: new Date()
    });
    console.log('✅ Test document inserted:', result.insertedId);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

testConnection();