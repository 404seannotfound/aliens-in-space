import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { generateToken, AuthRequest, authenticateToken } from '../middleware/auth.js';

export const authRouter = Router();

// Register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = await db.query(
      'SELECT id FROM players WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already taken' });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO players (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, avatar_type, benevolence, mischief, curiosity, experiment_points, created_at`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_type: user.avatar_type,
        reputation: {
          benevolence: user.benevolence,
          mischief: user.mischief,
          curiosity: user.curiosity
        },
        experiment_points: user.experiment_points
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await db.query(
      'SELECT * FROM players WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last seen
    await db.query('UPDATE players SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_type: user.avatar_type,
        reputation: {
          benevolence: user.benevolence,
          mischief: user.mischief,
          curiosity: user.curiosity
        },
        experiment_points: user.experiment_points
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, avatar_type, benevolence, mischief, curiosity, experiment_points, created_at, last_seen
       FROM players WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_type: user.avatar_type,
      reputation: {
        benevolence: user.benevolence,
        mischief: user.mischief,
        curiosity: user.curiosity
      },
      experiment_points: user.experiment_points,
      created_at: user.created_at,
      last_seen: user.last_seen
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update avatar
authRouter.patch('/avatar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { avatar_type } = req.body;
    const validAvatars = ['classic_grey', 'green_alien', 'purple_squid', 'robot', 'cosmic_entity', 'plasma_being'];
    
    if (!validAvatars.includes(avatar_type)) {
      return res.status(400).json({ error: 'Invalid avatar type' });
    }

    await db.query('UPDATE players SET avatar_type = $1 WHERE id = $2', [avatar_type, req.user!.id]);
    res.json({ message: 'Avatar updated', avatar_type });
  } catch (error) {
    console.error('Avatar update error:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Get leaderboard
authRouter.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        username, avatar_type, benevolence, mischief, curiosity,
        (benevolence + mischief + curiosity) as total_reputation
      FROM players 
      ORDER BY total_reputation DESC 
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});
