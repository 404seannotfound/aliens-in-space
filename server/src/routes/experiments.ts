import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { AuthRequest } from '../middleware/auth.js';

export const experimentRouter = Router();

const EXPERIMENT_TYPES = {
  biological: {
    seed_species: { cost: 15, cooldown: 60 },
    rewild: { cost: 10, cooldown: 30 },
    pandemic: { cost: 50, cooldown: 300 }
  },
  technological: {
    uplift: { cost: 30, cooldown: 120 },
    suppress: { cost: 25, cooldown: 120 },
    gift_knowledge: { cost: 20, cooldown: 60 }
  },
  sociopolitical: {
    ideology_nudge: { cost: 10, cooldown: 30 },
    prophetic_vision: { cost: 25, cooldown: 90 },
    policy_insanity: { cost: 40, cooldown: 180 }
  },
  catastrophic: {
    meteor: { cost: 100, cooldown: 600 },
    supervolcano: { cost: 80, cooldown: 500 },
    climate_event: { cost: 60, cooldown: 300 }
  },
  playful: {
    crop_circles: { cost: 5, cooldown: 15 },
    miracle: { cost: 15, cooldown: 45 },
    teleport_species: { cost: 20, cooldown: 60 }
  }
};

// Get available experiments
experimentRouter.get('/types', async (req: AuthRequest, res: Response) => {
  res.json(EXPERIMENT_TYPES);
});

// Get player's experiment history
experimentRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    
    const experiments = await db.query(`
      SELECT e.*, c.x, c.y, c.biome, civ.name as civilization_name
      FROM experiments e
      LEFT JOIN cells c ON e.target_id = c.id
      LEFT JOIN civilizations civ ON e.target_id = civ.id
      WHERE e.player_id = $1
      ORDER BY e.created_at DESC
      LIMIT $2
    `, [req.user!.id, Number(limit)]);

    res.json(experiments.rows);
  } catch (error) {
    console.error('Experiment history error:', error);
    res.status(500).json({ error: 'Failed to fetch experiment history' });
  }
});

// Get recent global experiments (action feed)
experimentRouter.get('/feed', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    
    const experiments = await db.query(`
      SELECT e.*, p.username, p.avatar_type, c.x, c.y, civ.name as civilization_name
      FROM experiments e
      JOIN players p ON e.player_id = p.id
      LEFT JOIN cells c ON e.target_id = c.id AND e.target_type = 'cell'
      LEFT JOIN civilizations civ ON e.target_id = civ.id AND e.target_type = 'civilization'
      WHERE e.status != 'pending'
      ORDER BY e.resolved_at DESC
      LIMIT $1
    `, [Number(limit)]);

    res.json(experiments.rows);
  } catch (error) {
    console.error('Experiment feed error:', error);
    res.status(500).json({ error: 'Failed to fetch experiment feed' });
  }
});

// Submit a new experiment
experimentRouter.post('/submit', async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, target_type, target_id, parameters } = req.body;

    // Validate experiment type
    const categoryTypes = EXPERIMENT_TYPES[category as keyof typeof EXPERIMENT_TYPES];
    if (!categoryTypes) {
      return res.status(400).json({ error: 'Invalid experiment category' });
    }

    const expType = categoryTypes[type as keyof typeof categoryTypes];
    if (!expType) {
      return res.status(400).json({ error: 'Invalid experiment type' });
    }

    // Check player has enough points
    const player = await db.query(
      'SELECT experiment_points FROM players WHERE id = $1',
      [req.user!.id]
    );

    if (player.rows[0].experiment_points < expType.cost) {
      return res.status(400).json({ error: 'Not enough experiment points' });
    }

    // Check cooldown
    const lastExp = await db.query(`
      SELECT created_at FROM experiments 
      WHERE player_id = $1 AND type = $2 
      ORDER BY created_at DESC LIMIT 1
    `, [req.user!.id, type]);

    if (lastExp.rows.length > 0) {
      const cooldownEnd = new Date(lastExp.rows[0].created_at);
      cooldownEnd.setSeconds(cooldownEnd.getSeconds() + expType.cooldown);
      
      if (new Date() < cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        return res.status(400).json({ 
          error: 'Experiment on cooldown', 
          cooldown_remaining: remaining 
        });
      }
    }

    // Get world ID
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(400).json({ error: 'No active world' });
    }

    // Validate target exists
    if (target_type === 'cell') {
      const cell = await db.query('SELECT id FROM cells WHERE id = $1', [target_id]);
      if (cell.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid target cell' });
      }
    } else if (target_type === 'civilization') {
      const civ = await db.query('SELECT id FROM civilizations WHERE id = $1', [target_id]);
      if (civ.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid target civilization' });
      }
    }

    // Deduct points
    await db.query(
      'UPDATE players SET experiment_points = experiment_points - $1 WHERE id = $2',
      [expType.cost, req.user!.id]
    );

    // Create experiment
    const result = await db.query(`
      INSERT INTO experiments (player_id, world_id, type, category, target_type, target_id, parameters, cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.user!.id, world.rows[0].id, type, category, target_type, target_id, JSON.stringify(parameters || {}), expType.cost]);

    res.status(201).json({
      message: 'Experiment submitted',
      experiment: result.rows[0],
      points_remaining: player.rows[0].experiment_points - expType.cost
    });
  } catch (error) {
    console.error('Experiment submission error:', error);
    res.status(500).json({ error: 'Failed to submit experiment' });
  }
});

// Get experiment by ID
experimentRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const experiment = await db.query(`
      SELECT e.*, p.username, p.avatar_type
      FROM experiments e
      JOIN players p ON e.player_id = p.id
      WHERE e.id = $1
    `, [id]);

    if (experiment.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json(experiment.rows[0]);
  } catch (error) {
    console.error('Experiment fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

// Cancel pending experiment
experimentRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const experiment = await db.query(
      "SELECT * FROM experiments WHERE id = $1 AND player_id = $2 AND status = 'pending'",
      [id, req.user!.id]
    );

    if (experiment.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found or cannot be cancelled' });
    }

    // Refund partial points (50%)
    const refund = Math.floor(experiment.rows[0].cost / 2);
    await db.query(
      'UPDATE players SET experiment_points = experiment_points + $1 WHERE id = $2',
      [refund, req.user!.id]
    );

    await db.query(
      "UPDATE experiments SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    res.json({ message: 'Experiment cancelled', refund });
  } catch (error) {
    console.error('Experiment cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel experiment' });
  }
});
