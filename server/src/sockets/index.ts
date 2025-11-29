import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aliens-in-space-secret-change-in-production';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

// Track online players
const onlinePlayers = new Map<string, { 
  socketId: string; 
  username: string; 
  avatar_type: string;
  position?: { lat: number; lon: number };
}>();

export function setupSocketHandlers(io: SocketServer) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; email: string };
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    if (!socket.user) return;

    console.log(`👽 ${socket.user.username} connected`);

    // Get player info
    const playerResult = await db.query(
      'SELECT avatar_type FROM players WHERE id = $1',
      [socket.user.id]
    );
    const avatar_type = playerResult.rows[0]?.avatar_type || 'classic_grey';

    // Add to online players
    onlinePlayers.set(socket.user.id, {
      socketId: socket.id,
      username: socket.user.username,
      avatar_type
    });

    // Update last seen
    await db.query('UPDATE players SET last_seen = NOW() WHERE id = $1', [socket.user.id]);

    // Broadcast player joined
    io.emit('playerJoined', {
      id: socket.user.id,
      username: socket.user.username,
      avatar_type
    });

    // Send current online players to new connection
    socket.emit('onlinePlayers', Array.from(onlinePlayers.entries()).map(([id, data]) => ({
      id,
      ...data
    })));

    // Handle orbit position updates
    socket.on('updatePosition', (position: { lat: number; lon: number }) => {
      if (!socket.user) return;
      
      const player = onlinePlayers.get(socket.user.id);
      if (player) {
        player.position = position;
        onlinePlayers.set(socket.user.id, player);
        
        // Broadcast position to others
        socket.broadcast.emit('playerMoved', {
          id: socket.user.id,
          position
        });
      }
    });

    // Handle chat messages
    socket.on('chatMessage', async (data: { channel: string; channel_id?: string; message: string }) => {
      if (!socket.user) return;
      
      const { channel, channel_id, message } = data;

      if (!message || message.trim().length === 0 || message.length > 500) {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      try {
        // Save to database
        const result = await db.query(`
          INSERT INTO chat_messages (player_id, channel, channel_id, message)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [socket.user.id, channel, channel_id || null, message.trim()]);

        const chatMessage = {
          ...result.rows[0],
          username: socket.user.username,
          avatar_type
        };

        // Broadcast to appropriate channel
        if (channel === 'global') {
          io.emit('chatMessage', chatMessage);
        } else if (channel === 'region' && channel_id) {
          io.to(`region:${channel_id}`).emit('chatMessage', chatMessage);
        }
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Join a region channel for regional chat
    socket.on('joinRegion', (cellId: string) => {
      socket.join(`region:${cellId}`);
      socket.emit('joinedRegion', { cellId });
    });

    socket.on('leaveRegion', (cellId: string) => {
      socket.leave(`region:${cellId}`);
    });

    // Handle cell selection (for viewing details)
    socket.on('selectCell', async (cellId: string) => {
      try {
        const cell = await db.query('SELECT * FROM cells WHERE id = $1', [cellId]);
        if (cell.rows.length === 0) {
          socket.emit('error', { message: 'Cell not found' });
          return;
        }

        const population = await db.query(`
          SELECT p.*, civ.name as civilization_name, civ.color as civilization_color
          FROM populations p
          LEFT JOIN civilizations civ ON p.civilization_id = civ.id
          WHERE p.cell_id = $1
        `, [cellId]);

        socket.emit('cellSelected', {
          cell: cell.rows[0],
          population: population.rows[0] || null
        });
      } catch (error) {
        console.error('Cell selection error:', error);
      }
    });

    // Handle experiment submission via socket (real-time)
    socket.on('submitExperiment', async (data: {
      category: string;
      type: string;
      target_type: string;
      target_id: string;
      parameters?: any;
    }) => {
      if (!socket.user) return;

      try {
        // Validate and process (simplified - full validation in REST endpoint)
        const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
        if (world.rows.length === 0) {
          socket.emit('experimentError', { message: 'No active world' });
          return;
        }

        const result = await db.query(`
          INSERT INTO experiments (player_id, world_id, type, category, target_type, target_id, parameters, cost)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 10)
          RETURNING *
        `, [socket.user.id, world.rows[0].id, data.type, data.category, data.target_type, data.target_id, JSON.stringify(data.parameters || {})]);

        socket.emit('experimentSubmitted', result.rows[0]);

        // Broadcast to all that an experiment was submitted
        io.emit('newExperiment', {
          player: socket.user.username,
          type: data.type,
          category: data.category,
          target_type: data.target_type
        });
      } catch (error) {
        console.error('Experiment submission error:', error);
        socket.emit('experimentError', { message: 'Failed to submit experiment' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (!socket.user) return;
      
      console.log(`👋 ${socket.user.username} disconnected`);
      onlinePlayers.delete(socket.user.id);
      
      io.emit('playerLeft', {
        id: socket.user.id,
        username: socket.user.username
      });
    });
  });
}

export function getOnlinePlayers() {
  return Array.from(onlinePlayers.entries()).map(([id, data]) => ({
    id,
    ...data
  }));
}
