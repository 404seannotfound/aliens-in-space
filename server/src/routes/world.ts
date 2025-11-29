import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { AuthRequest } from '../middleware/auth.js';

export const worldRouter = Router();

// Get current world state
worldRouter.get('/current', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT * FROM worlds WHERE status = 'running' LIMIT 1");
    
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    res.json(world.rows[0]);
  } catch (error) {
    console.error('World fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch world' });
  }
});

// Get all cells for the world
worldRouter.get('/cells', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const cells = await db.query(`
      SELECT c.id, c.x, c.y, c.lat, c.lon, c.biome, c.temperature, c.food_capacity
      FROM cells c
      WHERE c.world_id = $1
      ORDER BY c.y, c.x
    `, [world.rows[0].id]);

    res.json(cells.rows);
  } catch (error) {
    console.error('Cells fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch cells' });
  }
});

// Get populations with civilization info
worldRouter.get('/populations', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const populations = await db.query(`
      SELECT p.*, c.x, c.y, c.biome, civ.name as civilization_name, civ.color as civilization_color
      FROM populations p
      JOIN cells c ON p.cell_id = c.id
      LEFT JOIN civilizations civ ON p.civilization_id = civ.id
      WHERE c.world_id = $1
    `, [world.rows[0].id]);

    res.json(populations.rows);
  } catch (error) {
    console.error('Populations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch populations' });
  }
});

// Get civilizations
worldRouter.get('/civilizations', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const civilizations = await db.query(`
      SELECT civ.*, 
             COUNT(p.id) as num_cells,
             SUM(p.population_size) as total_population,
             AVG(p.tech_level) as avg_tech_level,
             AVG(p.prosperity) as avg_prosperity
      FROM civilizations civ
      LEFT JOIN populations p ON civ.id = p.civilization_id
      WHERE civ.world_id = $1
      GROUP BY civ.id
    `, [world.rows[0].id]);

    res.json(civilizations.rows);
  } catch (error) {
    console.error('Civilizations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch civilizations' });
  }
});

// Get species
worldRouter.get('/species', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const species = await db.query(`
      SELECT s.*, p.username as introduced_by_name
      FROM species s
      LEFT JOIN players p ON s.introduced_by = p.id
      WHERE s.world_id = $1
    `, [world.rows[0].id]);

    res.json(species.rows);
  } catch (error) {
    console.error('Species fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch species' });
  }
});

// Get cell details
worldRouter.get('/cell/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cell = await db.query('SELECT * FROM cells WHERE id = $1', [id]);
    if (cell.rows.length === 0) {
      return res.status(404).json({ error: 'Cell not found' });
    }

    const population = await db.query(`
      SELECT p.*, civ.name as civilization_name, civ.color as civilization_color
      FROM populations p
      LEFT JOIN civilizations civ ON p.civilization_id = civ.id
      WHERE p.cell_id = $1
    `, [id]);

    const species = await db.query(`
      SELECT s.*, cs.population_density
      FROM cell_species cs
      JOIN species s ON cs.species_id = s.id
      WHERE cs.cell_id = $1
    `, [id]);

    const recentEvents = await db.query(`
      SELECT * FROM events 
      WHERE target_cell_id = $1 
      ORDER BY start_tick DESC 
      LIMIT 10
    `, [id]);

    res.json({
      cell: cell.rows[0],
      population: population.rows[0] || null,
      species: species.rows,
      events: recentEvents.rows
    });
  } catch (error) {
    console.error('Cell details error:', error);
    res.status(500).json({ error: 'Failed to fetch cell details' });
  }
});

// Get world history
worldRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const { limit = 100 } = req.query;

    const snapshots = await db.query(`
      SELECT year, total_population, num_civilizations, avg_tech_level
      FROM world_snapshots
      WHERE world_id = $1
      ORDER BY tick DESC
      LIMIT $2
    `, [world.rows[0].id, Number(limit)]);

    res.json(snapshots.rows.reverse());
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get active events
worldRouter.get('/events', async (req: AuthRequest, res: Response) => {
  try {
    const world = await db.query("SELECT id FROM worlds WHERE status = 'running' LIMIT 1");
    if (world.rows.length === 0) {
      return res.status(404).json({ error: 'No active world' });
    }

    const events = await db.query(`
      SELECT e.*, c.x, c.y, civ.name as civilization_name
      FROM events e
      LEFT JOIN cells c ON e.target_cell_id = c.id
      LEFT JOIN civilizations civ ON e.target_civ_id = civ.id
      WHERE e.world_id = $1 AND e.is_active = true
    `, [world.rows[0].id]);

    res.json(events.rows);
  } catch (error) {
    console.error('Events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});
