import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { AuthRequest } from '../middleware/auth.js';

export const chatRouter = Router();

// Get chat messages for a channel
chatRouter.get('/:channel', async (req: AuthRequest, res: Response) => {
  try {
    const { channel } = req.params;
    const { channel_id, limit = 50, before } = req.query;

    let query = `
      SELECT m.*, p.username, p.avatar_type
      FROM chat_messages m
      JOIN players p ON m.player_id = p.id
      WHERE m.channel = $1
    `;
    const params: any[] = [channel];

    if (channel_id) {
      query += ` AND m.channel_id = $${params.length + 1}`;
      params.push(channel_id);
    }

    if (before) {
      query += ` AND m.created_at < $${params.length + 1}`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const messages = await db.query(query, params);

    res.json(messages.rows.reverse());
  } catch (error) {
    console.error('Chat fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Post a chat message (backup HTTP endpoint, mainly use WebSocket)
chatRouter.post('/:channel', async (req: AuthRequest, res: Response) => {
  try {
    const { channel } = req.params;
    const { message, channel_id } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    const result = await db.query(`
      INSERT INTO chat_messages (player_id, channel, channel_id, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.user!.id, channel, channel_id || null, message.trim()]);

    // Get user info for response
    const user = await db.query(
      'SELECT username, avatar_type FROM players WHERE id = $1',
      [req.user!.id]
    );

    res.status(201).json({
      ...result.rows[0],
      username: user.rows[0].username,
      avatar_type: user.rows[0].avatar_type
    });
  } catch (error) {
    console.error('Chat post error:', error);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// Delete own message
chatRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM chat_messages WHERE id = $1 AND player_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not yours' });
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Chat delete error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});
