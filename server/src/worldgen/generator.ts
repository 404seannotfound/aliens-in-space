import { db } from '../db/connection.js';

export interface WorldGenParams {
  continents: number;        // 1-7
  waterCoverage: number;     // 0.3-0.9 (30%-90%)
  avgTemperature: number;    // -20 to 40 celsius
  biomeVariety: number;      // 0.5-1.5 (multiplier for biome diversity)
  seed?: number;
}

interface NoisePoint {
  x: number;
  y: number;
  value: number;
}

// Simple 2D noise function (Perlin-like)
function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// Octave noise for more natural terrain
function octaveNoise(x: number, y: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// Determine biome based on elevation, temperature, and moisture
function determineBiome(
  elevation: number,
  latitude: number,
  moisture: number,
  avgTemp: number
): string {
  // Water
  if (elevation < 0.35) return 'ocean';
  
  // Calculate temperature based on latitude and global average
  const latTemp = avgTemp - Math.abs(latitude) * 0.8;
  
  // Mountains (high elevation)
  if (elevation > 0.75) {
    if (latTemp < -5) return 'arctic';
    if (latTemp < 10) return 'alpine';
    return 'mountain';
  }
  
  // Arctic/Tundra (cold)
  if (latTemp < -10) return 'arctic';
  if (latTemp < 0) return 'tundra';
  
  // Temperate/Tropical based on moisture
  if (latTemp > 25) {
    // Hot climates
    if (moisture < 0.3) return 'desert';
    if (moisture > 0.7) return 'jungle';
    return 'grassland';
  } else if (latTemp > 15) {
    // Warm climates
    if (moisture < 0.3) return 'desert';
    if (moisture > 0.6) return 'forest';
    return 'grassland';
  } else {
    // Cool climates
    if (moisture < 0.3) return 'tundra';
    if (moisture > 0.7) return 'wetland';
    if (moisture > 0.5) return 'forest';
    return 'grassland';
  }
}

export async function generateWorld(params: WorldGenParams, worldId: string) {
  const seed = params.seed || Math.floor(Math.random() * 1000000);
  
  console.log(`🌍 Generating world with params:`, params);
  
  // Generate grid of cells (72x36 = 2592 cells, 5° resolution)
  const cells = [];
  const cellSize = 5; // degrees
  
  for (let lat = -90 + cellSize / 2; lat < 90; lat += cellSize) {
    for (let lon = -180 + cellSize / 2; lon < 180; lon += cellSize) {
      const x = (lon + 180) / 360;
      const y = (lat + 90) / 180;
      
      // Generate elevation (continents)
      let elevation = 0;
      
      // Add continent centers
      for (let i = 0; i < params.continents; i++) {
        const cx = noise2D(i * 100, seed, 0);
        const cy = noise2D(i * 100, seed, 1);
        const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        elevation += Math.max(0, 0.6 - dist * 2);
      }
      
      // Add noise for natural variation
      elevation += octaveNoise(x * 4, y * 4, 4, seed) * 0.4;
      
      // Adjust for water coverage
      elevation = (elevation - (1 - params.waterCoverage)) / params.waterCoverage;
      elevation = Math.max(0, Math.min(1, elevation));
      
      // Generate moisture
      const moisture = octaveNoise(x * 3, y * 3, 3, seed + 1000) * params.biomeVariety;
      
      // Determine biome
      const biome = determineBiome(elevation, lat, moisture, params.avgTemperature);
      
      // Calculate cell properties
      const temperature = Math.round(params.avgTemperature - Math.abs(lat) * 0.6 + (Math.random() - 0.5) * 10);
      const foodCapacity = biome === 'ocean' ? 50 : 
                          biome === 'desert' ? 30 :
                          biome === 'arctic' ? 20 :
                          biome === 'tundra' ? 40 :
                          biome === 'mountain' ? 35 :
                          biome === 'alpine' ? 30 :
                          biome === 'wetland' ? 90 :
                          biome === 'jungle' ? 100 :
                          biome === 'forest' ? 80 :
                          biome === 'grassland' ? 70 : 50;
      
      cells.push({
        x: Math.round(lon / cellSize),
        y: Math.round(lat / cellSize),
        lat: Math.round(lat * 100) / 100,  // Round to 2 decimals
        lon: Math.round(lon * 100) / 100,  // Round to 2 decimals
        biome,
        temperature,
        food_capacity: foodCapacity
      });
    }
  }
  
  console.log(`📊 Generated ${cells.length} cells`);
  
  // Insert cells into database
  await db.query('DELETE FROM cells WHERE world_id = $1', [worldId]);
  
  for (const cell of cells) {
    await db.query(`
      INSERT INTO cells (world_id, x, y, lat, lon, biome, temperature, food_capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      worldId,
      cell.x,
      cell.y,
      cell.lat,
      cell.lon,
      cell.biome,
      cell.temperature,
      cell.food_capacity
    ]);
  }
  
  console.log(`✅ World generation complete`);
  
  // Seed some initial civilizations
  console.log(`🌱 Seeding initial civilizations...`);
  
  // Find suitable starting cells (grassland, forest, or jungle with good temperature)
  const suitableCells = await db.query(`
    SELECT id, biome, temperature 
    FROM cells 
    WHERE world_id = $1 
      AND biome IN ('grassland', 'forest', 'jungle')
      AND temperature BETWEEN 10 AND 30
      AND food_capacity > 60
    ORDER BY RANDOM()
    LIMIT 5
  `, [worldId]);
  
  const civColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
  const civNames = ['Terrans', 'Aquarians', 'Sylvans', 'Nomads', 'Highlanders'];
  
  for (let i = 0; i < suitableCells.rows.length; i++) {
    const cell = suitableCells.rows[i];
    
    // Create civilization
    const civResult = await db.query(`
      INSERT INTO civilizations (world_id, name, color, tech_level)
      VALUES ($1, $2, $3, 0)
      RETURNING id
    `, [worldId, civNames[i], civColors[i]]);
    
    const civId = civResult.rows[0].id;
    const popSize = 100 + Math.floor(Math.random() * 200);
    
    // Create initial population
    await db.query(`
      INSERT INTO populations (
        cell_id, civilization_id, population_size, 
        tech_level, prosperity, stability
      )
      VALUES ($1, $2, $3, 0, 50, 50)
    `, [cell.id, civId, popSize]);
    
    console.log(`  ✓ ${civNames[i]} (${popSize} people) at cell ${cell.id} (${cell.biome}, ${cell.temperature}°C)`);
  }
  
  console.log(`✅ Seeded ${suitableCells.rows.length} civilizations`);
  
  // Verify populations were created
  const popCheck = await db.query(`
    SELECT COUNT(*) as count FROM populations p
    JOIN cells c ON p.cell_id = c.id
    WHERE c.world_id = $1
  `, [worldId]);
  
  console.log(`📊 Population verification: ${popCheck.rows[0].count} populations in database`);
  
  return {
    cellCount: cells.length,
    seed,
    civilizationsSeeded: suitableCells.rows.length,
    populationsCreated: parseInt(popCheck.rows[0].count),
    biomeDistribution: cells.reduce((acc, cell) => {
      acc[cell.biome] = (acc[cell.biome] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}
