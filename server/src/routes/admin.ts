import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const adminRouter = Router();

// Get database metrics
adminRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics: any = {};

    // Table counts
    const tables = ['players', 'worlds', 'cells', 'populations', 'civilizations', 'species', 'cell_species', 'events', 'experiments', 'chat_messages', 'world_snapshots'];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        metrics[table] = parseInt(result.rows[0].count);
      } catch {
        metrics[table] = 'table not found';
      }
    }

    // World info
    try {
      const worldInfo = await db.query("SELECT id, name, seed, current_tick, current_year, status FROM worlds LIMIT 1");
      metrics.world_info = worldInfo.rows[0] || null;
    } catch {
      metrics.world_info = null;
    }

    // Database size
    try {
      const dbSize = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
      metrics.database_size = dbSize.rows[0].size;
    } catch {
      metrics.database_size = 'unknown';
    }

    // Player list
    try {
      const players = await db.query(`
        SELECT username, email, avatar_type, benevolence, mischief, curiosity, experiment_points, 
               created_at, last_seen 
        FROM players 
        ORDER BY created_at DESC
      `);
      metrics.players = players.rows;
    } catch {
      metrics.players = [];
    }

    // Connection test
    metrics.connection = 'ok';
    metrics.timestamp = new Date().toISOString();

    res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics', connection: 'failed' });
  }
});

// Run migrations (create tables)
adminRouter.post('/migrate', async (req: Request, res: Response) => {
  try {
    const migrations = `
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_type VARCHAR(50) DEFAULT 'classic_grey',
        benevolence INTEGER DEFAULT 0,
        mischief INTEGER DEFAULT 0,
        curiosity INTEGER DEFAULT 0,
        experiment_points INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS worlds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        seed INTEGER NOT NULL,
        current_tick BIGINT DEFAULT 0,
        current_year INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'running',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cells (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        lat DECIMAL(9,6),
        lon DECIMAL(9,6),
        biome VARCHAR(50) NOT NULL,
        elevation INTEGER DEFAULT 0,
        temperature INTEGER DEFAULT 15,
        moisture INTEGER DEFAULT 50,
        food_capacity INTEGER DEFAULT 100,
        mineral_capacity INTEGER DEFAULT 50,
        UNIQUE(world_id, x, y)
      );

      CREATE TABLE IF NOT EXISTS civilizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#888888',
        capital_cell_id UUID,
        founded_year INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS populations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cell_id UUID REFERENCES cells(id) ON DELETE CASCADE,
        civilization_id UUID,
        population_size BIGINT DEFAULT 0,
        tech_level INTEGER DEFAULT 0,
        stability INTEGER DEFAULT 50,
        prosperity INTEGER DEFAULT 50,
        education INTEGER DEFAULT 0,
        birth_rate DECIMAL(5,4) DEFAULT 0.02,
        death_rate DECIMAL(5,4) DEFAULT 0.015,
        ideology_collectivism INTEGER DEFAULT 50,
        ideology_tradition INTEGER DEFAULT 50,
        ideology_authoritarianism INTEGER DEFAULT 50,
        ideology_xenophobia INTEGER DEFAULT 50,
        war_tendency INTEGER DEFAULT 30,
        resource_efficiency DECIMAL(5,4) DEFAULT 1.0,
        environmental_impact DECIMAL(5,4) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS species (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        trophic_level VARCHAR(20) NOT NULL,
        reproduction_rate DECIMAL(5,4) DEFAULT 0.1,
        lifespan INTEGER DEFAULT 10,
        habitat_preferences JSONB DEFAULT '[]',
        is_native BOOLEAN DEFAULT true,
        introduced_by UUID REFERENCES players(id),
        introduced_year INTEGER
      );

      CREATE TABLE IF NOT EXISTS cell_species (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cell_id UUID REFERENCES cells(id) ON DELETE CASCADE,
        species_id UUID REFERENCES species(id) ON DELETE CASCADE,
        population_density INTEGER DEFAULT 100,
        UNIQUE(cell_id, species_id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        scope VARCHAR(20) NOT NULL,
        target_cell_id UUID REFERENCES cells(id),
        target_civ_id UUID REFERENCES civilizations(id),
        data JSONB DEFAULT '{}',
        start_tick BIGINT NOT NULL,
        end_tick BIGINT,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS experiments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id UUID,
        parameters JSONB DEFAULT '{}',
        cost INTEGER DEFAULT 10,
        status VARCHAR(20) DEFAULT 'pending',
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        channel VARCHAR(50) NOT NULL,
        channel_id UUID,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS world_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
        tick BIGINT NOT NULL,
        year INTEGER NOT NULL,
        total_population BIGINT,
        num_civilizations INTEGER,
        avg_tech_level DECIMAL(5,2),
        snapshot_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cells_world ON cells(world_id);
      CREATE INDEX IF NOT EXISTS idx_populations_cell ON populations(cell_id);
      CREATE INDEX IF NOT EXISTS idx_populations_civ ON populations(civilization_id);
      CREATE INDEX IF NOT EXISTS idx_experiments_player ON experiments(player_id);
      CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
      CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, channel_id);
      CREATE INDEX IF NOT EXISTS idx_events_world_active ON events(world_id, is_active);
    `;

    await db.query(migrations);
    res.json({ success: true, message: 'Migrations completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: 'Migration failed', details: String(error) });
  }
});

// Reset database (drop all data, keep tables)
adminRouter.post('/reset', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM world_snapshots');
    await db.query('DELETE FROM chat_messages');
    await db.query('DELETE FROM experiments');
    await db.query('DELETE FROM events');
    await db.query('DELETE FROM cell_species');
    await db.query('DELETE FROM species');
    await db.query('DELETE FROM populations');
    await db.query('DELETE FROM civilizations');
    await db.query('DELETE FROM cells');
    await db.query('DELETE FROM worlds');
    // Keep players - they can rejoin
    
    res.json({ success: true, message: 'World data reset successfully (players preserved)' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ success: false, error: 'Reset failed', details: String(error) });
  }
});

// Full reset including players
adminRouter.post('/reset-all', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM world_snapshots');
    await db.query('DELETE FROM chat_messages');
    await db.query('DELETE FROM experiments');
    await db.query('DELETE FROM events');
    await db.query('DELETE FROM cell_species');
    await db.query('DELETE FROM species');
    await db.query('DELETE FROM populations');
    await db.query('DELETE FROM civilizations');
    await db.query('DELETE FROM cells');
    await db.query('DELETE FROM worlds');
    await db.query('DELETE FROM players');
    
    res.json({ success: true, message: 'All data reset successfully' });
  } catch (error) {
    console.error('Reset all error:', error);
    res.status(500).json({ success: false, error: 'Reset failed', details: String(error) });
  }
});

// Seed with fake data
adminRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    const { includeFakePlayers = false } = req.body || {};

    const BIOMES = ['ocean', 'desert', 'forest', 'grassland', 'tundra', 'wetland', 'mountain', 'jungle'];
    
    function getBiomeForCoords(x: number, y: number, width: number, height: number): string {
      const latRatio = y / height;
      const noise = Math.sin(x * 0.5) * Math.cos(y * 0.3) + Math.sin(x * 0.1 + y * 0.2);
      if (latRatio < 0.15 || latRatio > 0.85) return 'tundra';
      if (latRatio > 0.4 && latRatio < 0.6) {
        if (noise > 0.3) return 'jungle';
        if (noise < -0.3) return 'desert';
        return 'grassland';
      }
      if (noise > 0.5) return 'mountain';
      if (noise > 0.2) return 'forest';
      if (noise < -0.4) return 'wetland';
      if (Math.abs(noise) < 0.1 && Math.random() > 0.6) return 'ocean';
      return 'grassland';
    }

    // Create world
    const worldId = uuidv4();
    const worldSeed = Math.floor(Math.random() * 1000000);
    await db.query(
      'INSERT INTO worlds (id, name, seed) VALUES ($1, $2, $3)',
      [worldId, 'Genesis', worldSeed]
    );

    // Grid dimensions
    const GRID_WIDTH = 64;
    const GRID_HEIGHT = 32;

    // Create cells
    const cellIds = new Map<string, string>();
    const cellsData: any[] = [];

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const id = uuidv4();
        const biome = getBiomeForCoords(x, y, GRID_WIDTH, GRID_HEIGHT);
        const lat = ((y / GRID_HEIGHT) * 180) - 90;
        const lon = ((x / GRID_WIDTH) * 360) - 180;
        const elevation = biome === 'mountain' ? 3000 : biome === 'ocean' ? -500 : Math.floor(Math.random() * 500);
        const temperature = Math.floor(25 - Math.abs(lat) * 0.5 + (biome === 'mountain' ? -15 : 0));
        const moisture = biome === 'ocean' ? 100 : biome === 'desert' ? 10 : biome === 'jungle' ? 90 : 50 + Math.floor(Math.random() * 30);
        const foodCapacity = biome === 'ocean' ? 20 : biome === 'desert' ? 10 : biome === 'jungle' ? 150 : 100;
        const mineralCapacity = biome === 'mountain' ? 200 : biome === 'desert' ? 80 : 50;

        cellIds.set(`${x},${y}`, id);
        cellsData.push([id, worldId, x, y, lat, lon, biome, elevation, temperature, moisture, foodCapacity, mineralCapacity]);
      }
    }

    for (const cell of cellsData) {
      await db.query(
        'INSERT INTO cells (id, world_id, x, y, lat, lon, biome, elevation, temperature, moisture, food_capacity, mineral_capacity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        cell
      );
    }

    // Create species
    const speciesTemplates = [
      { name: 'Grass', trophic_level: 'producer', reproduction_rate: 0.3, lifespan: 1 },
      { name: 'Trees', trophic_level: 'producer', reproduction_rate: 0.05, lifespan: 100 },
      { name: 'Rabbits', trophic_level: 'herbivore', reproduction_rate: 0.4, lifespan: 5 },
      { name: 'Deer', trophic_level: 'herbivore', reproduction_rate: 0.15, lifespan: 15 },
      { name: 'Wolves', trophic_level: 'predator', reproduction_rate: 0.1, lifespan: 12 },
      { name: 'Eagles', trophic_level: 'predator', reproduction_rate: 0.08, lifespan: 20 },
      { name: 'Fish', trophic_level: 'omnivore', reproduction_rate: 0.5, lifespan: 3 },
    ];

    const speciesIds: string[] = [];
    for (const template of speciesTemplates) {
      const speciesId = uuidv4();
      speciesIds.push(speciesId);
      await db.query(
        'INSERT INTO species (id, world_id, name, trophic_level, reproduction_rate, lifespan, is_native) VALUES ($1, $2, $3, $4, $5, $6, true)',
        [speciesId, worldId, template.name, template.trophic_level, template.reproduction_rate, template.lifespan]
      );
    }

    // Populate ecosystems
    for (const cell of cellsData) {
      const [cellId, , , , , , biome] = cell;
      if (biome === 'ocean') {
        await db.query(
          'INSERT INTO cell_species (cell_id, species_id, population_density) VALUES ($1, $2, $3)',
          [cellId, speciesIds[6], Math.floor(Math.random() * 500) + 100]
        );
      } else {
        const numSpecies = Math.floor(Math.random() * 4) + 2;
        const landSpecies = speciesIds.slice(0, 6);
        const selectedSpecies = landSpecies.sort(() => Math.random() - 0.5).slice(0, numSpecies);
        for (const speciesId of selectedSpecies) {
          await db.query(
            'INSERT INTO cell_species (cell_id, species_id, population_density) VALUES ($1, $2, $3)',
            [cellId, speciesId, Math.floor(Math.random() * 300) + 50]
          );
        }
      }
    }

    // Create civilizations
    const civColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const civNames = ['Aurelians', 'Nordheim', 'Saharan League', 'Eastern Empire', 'Island Federation', 'Forest Collective'];
    const civStartPoints = [
      { x: 32, y: 16 }, { x: 16, y: 8 }, { x: 48, y: 24 },
      { x: 48, y: 8 }, { x: 16, y: 24 }, { x: 32, y: 8 },
    ];

    for (let i = 0; i < 6; i++) {
      const civId = uuidv4();
      const capitalCellId = cellIds.get(`${civStartPoints[i].x},${civStartPoints[i].y}`);

      await db.query(
        'INSERT INTO civilizations (id, world_id, name, color, capital_cell_id) VALUES ($1, $2, $3, $4, $5)',
        [civId, worldId, civNames[i], civColors[i], capitalCellId]
      );

      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          const cx = civStartPoints[i].x + dx;
          const cy = civStartPoints[i].y + dy;
          const cellId = cellIds.get(`${cx},${cy}`);
          if (cellId) {
            const cellData = cellsData.find(c => c[0] === cellId);
            if (cellData && cellData[6] !== 'ocean') {
              const distFromCapital = Math.abs(dx) + Math.abs(dy);
              const popSize = Math.floor(10000 / (distFromCapital + 1) * (0.5 + Math.random()));
              const techLevel = dx === 0 && dy === 0 ? 2 : 1;
              await db.query(
                `INSERT INTO populations (cell_id, civilization_id, population_size, tech_level, stability, prosperity, education)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [cellId, civId, popSize, techLevel, 50 + Math.floor(Math.random() * 20), 40 + Math.floor(Math.random() * 30), techLevel * 10]
              );
            }
          }
        }
      }
    }

    // Create fake players if requested
    if (includeFakePlayers) {
      const fakeUsers = [
        { username: 'CosmicObserver', email: 'cosmic@test.com' },
        { username: 'GalacticMeddler', email: 'galactic@test.com' },
        { username: 'StardustSage', email: 'stardust@test.com' },
        { username: 'NebulaWatcher', email: 'nebula@test.com' },
        { username: 'VoidDweller', email: 'void@test.com' },
      ];
      // Password: "password123" hashed with bcrypt
      const passwordHash = '$2a$10$rQnM1.F8VoYxQHgJgHYzYeYhqLqLVWvLgJOvqM0KpYFfLpE/dJWGK';
      
      for (const user of fakeUsers) {
        await db.query(
          `INSERT INTO players (username, email, password_hash, benevolence, mischief, curiosity, experiment_points)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO NOTHING`,
          [user.username, user.email, passwordHash, Math.floor(Math.random() * 100), Math.floor(Math.random() * 100), Math.floor(Math.random() * 100), 100]
        );
      }
    }

    // Create initial snapshot
    const result = await db.query(
      `SELECT SUM(p.population_size) as total_pop, COUNT(DISTINCT p.civilization_id) as num_civs, AVG(p.tech_level) as avg_tech FROM populations p`
    );
    await db.query(
      `INSERT INTO world_snapshots (world_id, tick, year, total_population, num_civilizations, avg_tech_level) VALUES ($1, 0, 0, $2, $3, $4)`,
      [worldId, result.rows[0].total_pop, result.rows[0].num_civs, result.rows[0].avg_tech]
    );

    res.json({
      success: true,
      message: 'World seeded successfully',
      stats: {
        cells: cellsData.length,
        civilizations: 6,
        species: speciesTemplates.length,
        fakePlayers: includeFakePlayers ? 5 : 0
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, error: 'Seeding failed', details: String(error) });
  }
});
