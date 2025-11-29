import { db } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

const BIOMES = ['ocean', 'desert', 'forest', 'grassland', 'tundra', 'wetland', 'mountain', 'jungle'];
const SPECIES_TEMPLATES = [
  { name: 'Grass', trophic_level: 'producer', reproduction_rate: 0.3, lifespan: 1 },
  { name: 'Trees', trophic_level: 'producer', reproduction_rate: 0.05, lifespan: 100 },
  { name: 'Rabbits', trophic_level: 'herbivore', reproduction_rate: 0.4, lifespan: 5 },
  { name: 'Deer', trophic_level: 'herbivore', reproduction_rate: 0.15, lifespan: 15 },
  { name: 'Wolves', trophic_level: 'predator', reproduction_rate: 0.1, lifespan: 12 },
  { name: 'Eagles', trophic_level: 'predator', reproduction_rate: 0.08, lifespan: 20 },
  { name: 'Fish', trophic_level: 'omnivore', reproduction_rate: 0.5, lifespan: 3 },
];

function getBiomeForCoords(x: number, y: number, width: number, height: number): string {
  // Simple noise-like biome generation
  const latRatio = y / height;
  const noise = Math.sin(x * 0.5) * Math.cos(y * 0.3) + Math.sin(x * 0.1 + y * 0.2);
  
  // Polar regions
  if (latRatio < 0.15 || latRatio > 0.85) return 'tundra';
  
  // Equatorial regions
  if (latRatio > 0.4 && latRatio < 0.6) {
    if (noise > 0.3) return 'jungle';
    if (noise < -0.3) return 'desert';
    return 'grassland';
  }
  
  // Mid-latitudes
  if (noise > 0.5) return 'mountain';
  if (noise > 0.2) return 'forest';
  if (noise < -0.4) return 'wetland';
  
  // Ocean cells (scattered)
  if (Math.abs(noise) < 0.1 && Math.random() > 0.6) return 'ocean';
  
  return 'grassland';
}

async function seed() {
  console.log('🌱 Seeding database...');
  
  try {
    // Clear existing data
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
    
    // Create a world
    const worldId = uuidv4();
    const worldSeed = Math.floor(Math.random() * 1000000);
    await db.query(
      'INSERT INTO worlds (id, name, seed) VALUES ($1, $2, $3)',
      [worldId, 'Genesis', worldSeed]
    );
    console.log(`🌍 Created world: Genesis (seed: ${worldSeed})`);
    
    // Grid dimensions (creates a hex-like grid mapped to a sphere)
    const GRID_WIDTH = 64;
    const GRID_HEIGHT = 32;
    
    // Create cells
    console.log('📍 Creating cells...');
    const cellsData: any[] = [];
    const cellIds: Map<string, string> = new Map();
    
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
    
    // Batch insert cells
    for (const cell of cellsData) {
      await db.query(
        'INSERT INTO cells (id, world_id, x, y, lat, lon, biome, elevation, temperature, moisture, food_capacity, mineral_capacity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        cell
      );
    }
    console.log(`✅ Created ${cellsData.length} cells`);
    
    // Create species
    console.log('🦎 Creating species...');
    const speciesIds: string[] = [];
    for (const template of SPECIES_TEMPLATES) {
      const speciesId = uuidv4();
      speciesIds.push(speciesId);
      await db.query(
        'INSERT INTO species (id, world_id, name, trophic_level, reproduction_rate, lifespan, is_native) VALUES ($1, $2, $3, $4, $5, $6, true)',
        [speciesId, worldId, template.name, template.trophic_level, template.reproduction_rate, template.lifespan]
      );
    }
    console.log(`✅ Created ${speciesIds.length} species`);
    
    // Populate cells with species (skip oceans for land species)
    console.log('🌿 Populating ecosystems...');
    let cellSpeciesCount = 0;
    for (const cell of cellsData) {
      const [cellId, , , , , , biome] = cell;
      if (biome === 'ocean') {
        // Only fish in oceans
        await db.query(
          'INSERT INTO cell_species (cell_id, species_id, population_density) VALUES ($1, $2, $3)',
          [cellId, speciesIds[6], Math.floor(Math.random() * 500) + 100]
        );
        cellSpeciesCount++;
      } else {
        // Add random land species
        const numSpecies = Math.floor(Math.random() * 4) + 2;
        const landSpecies = speciesIds.slice(0, 6);
        const selectedSpecies = landSpecies.sort(() => Math.random() - 0.5).slice(0, numSpecies);
        
        for (const speciesId of selectedSpecies) {
          await db.query(
            'INSERT INTO cell_species (cell_id, species_id, population_density) VALUES ($1, $2, $3)',
            [cellId, speciesId, Math.floor(Math.random() * 300) + 50]
          );
          cellSpeciesCount++;
        }
      }
    }
    console.log(`✅ Created ${cellSpeciesCount} cell-species relationships`);
    
    // Create initial civilizations
    console.log('🏛️ Creating civilizations...');
    const civColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const civNames = ['Aurelians', 'Nordheim', 'Saharan League', 'Eastern Empire', 'Island Federation', 'Forest Collective'];
    const civStartPoints = [
      { x: 32, y: 16 },  // Center
      { x: 16, y: 8 },   // Northwest
      { x: 48, y: 24 },  // Southeast
      { x: 48, y: 8 },   // Northeast
      { x: 16, y: 24 },  // Southwest
      { x: 32, y: 8 },   // North
    ];
    
    for (let i = 0; i < 6; i++) {
      const civId = uuidv4();
      const capitalCellId = cellIds.get(`${civStartPoints[i].x},${civStartPoints[i].y}`);
      
      await db.query(
        'INSERT INTO civilizations (id, world_id, name, color, capital_cell_id) VALUES ($1, $2, $3, $4, $5)',
        [civId, worldId, civNames[i], civColors[i], capitalCellId]
      );
      
      // Create populations for this civilization (spread from capital)
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          
          const cx = civStartPoints[i].x + dx;
          const cy = civStartPoints[i].y + dy;
          const cellId = cellIds.get(`${cx},${cy}`);
          
          if (cellId) {
            // Check biome - skip oceans
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
    console.log(`✅ Created ${civNames.length} civilizations with populations`);
    
    // Create initial world snapshot
    const result = await db.query(
      `SELECT 
        SUM(p.population_size) as total_pop,
        COUNT(DISTINCT p.civilization_id) as num_civs,
        AVG(p.tech_level) as avg_tech
       FROM populations p`
    );
    
    await db.query(
      `INSERT INTO world_snapshots (world_id, tick, year, total_population, num_civilizations, avg_tech_level)
       VALUES ($1, 0, 0, $2, $3, $4)`,
      [worldId, result.rows[0].total_pop, result.rows[0].num_civs, result.rows[0].avg_tech]
    );
    
    console.log('✅ Seeding completed successfully!');
    console.log(`📊 World Stats: ${result.rows[0].total_pop} population, ${result.rows[0].num_civs} civilizations`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
