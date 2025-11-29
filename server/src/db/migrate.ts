import { db } from './connection.js';

const migrations = `
-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_type VARCHAR(50) DEFAULT 'classic_grey',
  benevolence INTEGER DEFAULT 0,
  mischief INTEGER DEFAULT 0,
  curiosity INTEGER DEFAULT 0,
  experiment_points INTEGER DEFAULT 1000,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

-- Worlds table
CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  seed INTEGER NOT NULL,
  current_tick BIGINT DEFAULT 0,
  current_year INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cells table (the grid)
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

-- Populations table
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

-- Civilizations table
CREATE TABLE IF NOT EXISTS civilizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#888888',
  capital_cell_id UUID,
  founded_year INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
);

-- Species table
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

-- Cell species (what species exist in each cell)
CREATE TABLE IF NOT EXISTS cell_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id UUID REFERENCES cells(id) ON DELETE CASCADE,
  species_id UUID REFERENCES species(id) ON DELETE CASCADE,
  population_density INTEGER DEFAULT 100,
  UNIQUE(cell_id, species_id)
);

-- Events table
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

-- Experiments table
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

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  channel_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- World snapshots for history
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

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_cells_world ON cells(world_id);
CREATE INDEX IF NOT EXISTS idx_populations_cell ON populations(cell_id);
CREATE INDEX IF NOT EXISTS idx_populations_civ ON populations(civilization_id);
CREATE INDEX IF NOT EXISTS idx_experiments_player ON experiments(player_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, channel_id);
CREATE INDEX IF NOT EXISTS idx_events_world_active ON events(world_id, is_active);
`;

async function migrate() {
  console.log('🔧 Running database migrations...');
  
  try {
    await db.query(migrations);
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
