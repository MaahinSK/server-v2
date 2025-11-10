import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI;

// Simple connection
async function connectDB() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  }
}

// Import and use routes directly
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js'; 
import userRoutes from './routes/users.js';

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Simple test endpoint
app.get('/api/test', async (req, res) => {
  await connectDB();
  const result = await mongoose.connection.db.collection('tests').insertOne({ test: true, time: new Date() });
  res.json({ success: true, id: result.insertedId });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error, req, res, next) => res.status(500).json({ error: 'Server error: ' + error.message }));

export default app;