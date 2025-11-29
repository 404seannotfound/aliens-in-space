import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db/connection.js';
import { authRouter } from './routes/auth.js';
import { worldRouter } from './routes/world.js';
import { experimentRouter } from './routes/experiments.js';
import { chatRouter } from './routes/chat.js';
import { setupSocketHandlers } from './sockets/index.js';
import { SimulationEngine } from './simulation/engine.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/world', authenticateToken, worldRouter);
app.use('/api/experiments', authenticateToken, experimentRouter);
app.use('/api/chat', authenticateToken, chatRouter);

// Socket.io setup
setupSocketHandlers(io);

// Initialize simulation engine
const simulation = new SimulationEngine(io);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('📦 Database connected');

    // Start simulation loop
    simulation.start();
    console.log('🧬 Simulation engine started');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Aliens in Space is ready!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { io, simulation };
