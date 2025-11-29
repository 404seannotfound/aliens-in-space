import { Server as SocketServer } from 'socket.io';
import { db } from '../db/connection.js';

interface CellState {
  id: string;
  x: number;
  y: number;
  biome: string;
  food_capacity: number;
  temperature: number;
  moisture: number;
}

interface PopulationState {
  id: string;
  cell_id: string;
  civilization_id: string;
  population_size: number;
  tech_level: number;
  stability: number;
  prosperity: number;
  education: number;
  birth_rate: number;
  death_rate: number;
  ideology_collectivism: number;
  ideology_tradition: number;
  ideology_authoritarianism: number;
  ideology_xenophobia: number;
  war_tendency: number;
  resource_efficiency: number;
  environmental_impact: number;
}

const TECH_LEVELS = ['Stone Age', 'Bronze Age', 'Iron Age', 'Medieval', 'Renaissance', 'Industrial', 'Modern', 'Atomic', 'Digital', 'Post-Singularity'];
const TICKS_PER_YEAR = 60; // 1 minute = 1 year

export class SimulationEngine {
  private io: SocketServer;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentTick = 0;
  private currentYear = 0;
  private worldId: string | null = null;
  private isRunning = false;

  constructor(io: SocketServer) {
    this.io = io;
  }

  async start() {
    // Get the active world
    const result = await db.query("SELECT id, current_tick, current_year FROM worlds WHERE status = 'running' LIMIT 1");
    if (result.rows.length === 0) {
      console.log('No active world found. Create one with db:seed');
      return;
    }

    this.worldId = result.rows[0].id;
    this.currentTick = result.rows[0].current_tick;
    this.currentYear = result.rows[0].current_year;
    this.isRunning = true;

    console.log(`🌍 Simulation started for world ${this.worldId} at tick ${this.currentTick} (year ${this.currentYear})`);

    // Run simulation tick every second
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Simulation stopped');
  }

  private async tick() {
    if (!this.worldId || !this.isRunning) return;

    this.currentTick++;
    const isYearEnd = this.currentTick % TICKS_PER_YEAR === 0;
    if (isYearEnd) {
      this.currentYear++;
    }

    try {
      // Get all populations with their cell data
      const populations = await this.getPopulations();
      const cells = await this.getCells();
      const cellMap = new Map(cells.map(c => [c.id, c]));
      const neighborMap = this.buildNeighborMap(cells);

      // Process each population
      for (const pop of populations) {
        const cell = cellMap.get(pop.cell_id);
        if (!cell) continue;

        const neighbors = neighborMap.get(`${cell.x},${cell.y}`) || [];
        const neighborPops = populations.filter(p => neighbors.some(n => n.id === p.cell_id));

        await this.updatePopulation(pop, cell, neighborPops, isYearEnd);
      }

      // Handle migrations on year boundaries
      if (isYearEnd) {
        await this.processMigrations(populations, cells, neighborMap);
        await this.processConflicts(populations);
        await this.processTechSpread(populations, neighborMap, cellMap);
        await this.processEvents();
        await this.resolveExperiments();
        await this.createSnapshot();
      }

      // Update world tick
      await db.query(
        'UPDATE worlds SET current_tick = $1, current_year = $2 WHERE id = $3',
        [this.currentTick, this.currentYear, this.worldId]
      );

      // Broadcast tick update
      this.io.emit('tick', {
        tick: this.currentTick,
        year: this.currentYear,
        isYearEnd
      });

      // Broadcast population changes on year boundaries
      if (isYearEnd) {
        const stats = await this.getWorldStats();
        this.io.emit('yearUpdate', {
          year: this.currentYear,
          stats
        });
      }
    } catch (error) {
      console.error('Tick error:', error);
    }
  }

  private async getPopulations(): Promise<PopulationState[]> {
    const result = await db.query(`
      SELECT p.*, c.x, c.y 
      FROM populations p 
      JOIN cells c ON p.cell_id = c.id 
      WHERE c.world_id = $1
    `, [this.worldId]);
    return result.rows;
  }

  private async getCells(): Promise<CellState[]> {
    const result = await db.query('SELECT * FROM cells WHERE world_id = $1', [this.worldId]);
    return result.rows;
  }

  private buildNeighborMap(cells: CellState[]): Map<string, CellState[]> {
    const map = new Map<string, CellState[]>();
    const cellGrid = new Map(cells.map(c => [`${c.x},${c.y}`, c]));

    for (const cell of cells) {
      const neighbors: CellState[] = [];
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]];
      
      for (const [dx, dy] of directions) {
        const neighbor = cellGrid.get(`${cell.x + dx},${cell.y + dy}`);
        if (neighbor) neighbors.push(neighbor);
      }
      
      map.set(`${cell.x},${cell.y}`, neighbors);
    }

    return map;
  }

  private async updatePopulation(
    pop: PopulationState,
    cell: CellState,
    neighbors: PopulationState[],
    isYearEnd: boolean
  ) {
    // Calculate modifiers based on environment and neighbors
    const carryingCapacity = this.calculateCarryingCapacity(cell, pop.tech_level);
    const crowdingFactor = pop.population_size / carryingCapacity;
    
    // Adjust birth/death rates based on conditions
    let effectiveBirthRate = pop.birth_rate * pop.prosperity / 50;
    let effectiveDeathRate = pop.death_rate;

    // Overpopulation stress
    if (crowdingFactor > 1) {
      effectiveDeathRate += (crowdingFactor - 1) * 0.01;
      effectiveBirthRate *= Math.max(0.5, 1 - (crowdingFactor - 1) * 0.2);
    }

    // Tech level affects both
    effectiveBirthRate *= 1 + pop.tech_level * 0.02;
    effectiveDeathRate *= Math.max(0.3, 1 - pop.tech_level * 0.05);

    // Climate effects
    if (cell.temperature < 0 || cell.temperature > 40) {
      effectiveDeathRate += 0.005;
    }

    // Calculate population change (per tick, so divide by ticks per year)
    const birthsPerTick = Math.floor(pop.population_size * effectiveBirthRate / TICKS_PER_YEAR);
    const deathsPerTick = Math.floor(pop.population_size * effectiveDeathRate / TICKS_PER_YEAR);
    const netChange = birthsPerTick - deathsPerTick;

    let newPopulation = Math.max(0, pop.population_size + netChange);

    // Small random variation
    newPopulation = Math.floor(newPopulation * (0.999 + Math.random() * 0.002));

    // Update stability based on prosperity and ideology
    let newStability = pop.stability;
    if (pop.prosperity < 30) newStability -= 0.1;
    if (pop.prosperity > 70) newStability += 0.05;
    newStability = Math.max(0, Math.min(100, newStability));

    // Update prosperity based on resources and tech
    let newProsperity = pop.prosperity;
    if (crowdingFactor < 0.8 && pop.tech_level > 2) newProsperity += 0.05;
    if (crowdingFactor > 1.2) newProsperity -= 0.1;
    newProsperity = Math.max(0, Math.min(100, newProsperity));

    // Yearly education growth
    let newEducation = pop.education;
    if (isYearEnd && pop.stability > 50 && pop.prosperity > 40) {
      newEducation += Math.random() * 0.5;
      newEducation = Math.min(100, newEducation);
    }

    // Tech level advancement (rare, on year boundaries)
    let newTechLevel = pop.tech_level;
    if (isYearEnd && pop.education > (pop.tech_level + 1) * 10 && Math.random() < 0.01 * pop.education / 100) {
      newTechLevel = Math.min(9, pop.tech_level + 1);
      console.log(`🔬 Tech advancement! ${pop.civilization_id} reached ${TECH_LEVELS[newTechLevel]}`);
      
      // Notify clients
      this.io.emit('techAdvancement', {
        civilization_id: pop.civilization_id,
        tech_level: newTechLevel,
        tech_name: TECH_LEVELS[newTechLevel],
        cell_id: pop.cell_id
      });
    }

    // Ideology drift (influenced by neighbors)
    const avgNeighborCollectivism = neighbors.length > 0 
      ? neighbors.reduce((sum, n) => sum + n.ideology_collectivism, 0) / neighbors.length 
      : pop.ideology_collectivism;
    const newCollectivism = pop.ideology_collectivism + (avgNeighborCollectivism - pop.ideology_collectivism) * 0.001;

    await db.query(`
      UPDATE populations SET 
        population_size = $1, stability = $2, prosperity = $3, education = $4,
        tech_level = $5, ideology_collectivism = $6, updated_at = NOW()
      WHERE id = $7
    `, [newPopulation, newStability, newProsperity, newEducation, newTechLevel, newCollectivism, pop.id]);
  }

  private calculateCarryingCapacity(cell: CellState, techLevel: number): number {
    const baseCap = cell.food_capacity * 100;
    const techMultiplier = 1 + techLevel * 0.5;
    const biomeMultiplier = cell.biome === 'ocean' ? 0.1 : cell.biome === 'desert' ? 0.3 : 1;
    return Math.floor(baseCap * techMultiplier * biomeMultiplier);
  }

  private async processMigrations(
    populations: PopulationState[],
    cells: CellState[],
    neighborMap: Map<string, CellState[]>
  ) {
    // Populations migrate when overcrowded or seeking better conditions
    for (const pop of populations) {
      if (pop.population_size < 1000) continue; // Too small to migrate
      
      const cell = cells.find(c => c.id === pop.cell_id);
      if (!cell) continue;

      const carryingCap = this.calculateCarryingCapacity(cell, pop.tech_level);
      if (pop.population_size < carryingCap * 0.9) continue; // Not crowded enough

      const neighbors = neighborMap.get(`${cell.x},${cell.y}`) || [];
      const emptyOrLessPopulated = neighbors.filter(n => {
        const neighborPop = populations.find(p => p.cell_id === n.id);
        if (!neighborPop) return n.biome !== 'ocean';
        return neighborPop.population_size < carryingCap * 0.5 && n.biome !== 'ocean';
      });

      if (emptyOrLessPopulated.length > 0) {
        const target = emptyOrLessPopulated[Math.floor(Math.random() * emptyOrLessPopulated.length)];
        const migrants = Math.floor(pop.population_size * 0.1);

        // Check if there's already a population there
        const existingPop = populations.find(p => p.cell_id === target.id);
        
        if (existingPop) {
          // Merge migrants into existing population
          await db.query(
            'UPDATE populations SET population_size = population_size + $1 WHERE id = $2',
            [migrants, existingPop.id]
          );
        } else {
          // Create new population
          await db.query(`
            INSERT INTO populations (cell_id, civilization_id, population_size, tech_level, stability, prosperity, education)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [target.id, pop.civilization_id, migrants, Math.max(0, pop.tech_level - 1), 50, 40, pop.education * 0.8]);
        }

        // Reduce source population
        await db.query(
          'UPDATE populations SET population_size = population_size - $1 WHERE id = $2',
          [migrants, pop.id]
        );

        this.io.emit('migration', {
          from: pop.cell_id,
          to: target.id,
          migrants,
          civilization_id: pop.civilization_id
        });
      }
    }
  }

  private async processConflicts(populations: PopulationState[]) {
    // Group populations by cell to find conflicts
    const cellPops = new Map<string, PopulationState[]>();
    for (const pop of populations) {
      const existing = cellPops.get(pop.cell_id) || [];
      existing.push(pop);
      cellPops.set(pop.cell_id, existing);
    }

    for (const [cellId, pops] of cellPops) {
      if (pops.length < 2) continue;

      // Multiple civilizations in same cell - potential conflict
      const differentCivs = [...new Set(pops.map(p => p.civilization_id))];
      if (differentCivs.length < 2) continue;

      // Calculate conflict probability based on war tendency and xenophobia
      const avgWarTendency = pops.reduce((sum, p) => sum + p.war_tendency, 0) / pops.length;
      const avgXenophobia = pops.reduce((sum, p) => sum + p.ideology_xenophobia, 0) / pops.length;
      const conflictChance = (avgWarTendency + avgXenophobia) / 200;

      if (Math.random() < conflictChance) {
        // Conflict! Larger population has advantage
        pops.sort((a, b) => b.population_size - a.population_size);
        const winner = pops[0];
        const loser = pops[1];

        const winnerLosses = Math.floor(winner.population_size * 0.05);
        const loserLosses = Math.floor(loser.population_size * 0.15);

        await db.query('UPDATE populations SET population_size = population_size - $1, stability = stability - 10 WHERE id = $2', [winnerLosses, winner.id]);
        await db.query('UPDATE populations SET population_size = population_size - $1, stability = stability - 20 WHERE id = $2', [loserLosses, loser.id]);

        this.io.emit('conflict', {
          cell_id: cellId,
          winner_civ: winner.civilization_id,
          loser_civ: loser.civilization_id,
          winner_losses: winnerLosses,
          loser_losses: loserLosses
        });

        // Log event
        await db.query(`
          INSERT INTO events (world_id, type, scope, target_cell_id, data, start_tick, is_active)
          VALUES ($1, 'conflict', 'cell', $2, $3, $4, false)
        `, [this.worldId, cellId, JSON.stringify({ winner: winner.civilization_id, loser: loser.civilization_id }), this.currentTick]);
      }
    }
  }

  private async processTechSpread(
    populations: PopulationState[],
    neighborMap: Map<string, CellState[]>,
    cellMap: Map<string, CellState>
  ) {
    // Tech spreads from high-tech to low-tech neighbors
    for (const pop of populations) {
      const cell = cellMap.get(pop.cell_id);
      if (!cell) continue;

      const neighbors = neighborMap.get(`${cell.x},${cell.y}`) || [];
      
      for (const neighborCell of neighbors) {
        const neighborPops = populations.filter(p => p.cell_id === neighborCell.id);
        
        for (const neighborPop of neighborPops) {
          if (pop.tech_level > neighborPop.tech_level + 1) {
            // Tech diffusion
            const spreadChance = 0.001 * (pop.tech_level - neighborPop.tech_level);
            if (Math.random() < spreadChance) {
              await db.query('UPDATE populations SET education = education + 1 WHERE id = $1', [neighborPop.id]);
            }
          }
        }
      }
    }
  }

  private async processEvents() {
    // Process active events
    const events = await db.query(
      'SELECT * FROM events WHERE world_id = $1 AND is_active = true',
      [this.worldId]
    );

    for (const event of events.rows) {
      // Check if event should end
      if (event.end_tick && this.currentTick >= event.end_tick) {
        await db.query('UPDATE events SET is_active = false WHERE id = $1', [event.id]);
        continue;
      }

      // Apply event effects based on type
      switch (event.type) {
        case 'golden_age':
          await this.applyGoldenAge(event);
          break;
        case 'famine':
          await this.applyFamine(event);
          break;
        case 'plague':
          await this.applyPlague(event);
          break;
        // Add more event types
      }
    }

    // Random event generation (rare)
    if (Math.random() < 0.001) {
      await this.generateRandomEvent();
    }
  }

  private async applyGoldenAge(event: any) {
    if (event.target_civ_id) {
      await db.query(`
        UPDATE populations SET prosperity = LEAST(100, prosperity + 0.5), education = LEAST(100, education + 0.2)
        WHERE civilization_id = $1
      `, [event.target_civ_id]);
    }
  }

  private async applyFamine(event: any) {
    if (event.target_cell_id) {
      await db.query(`
        UPDATE populations SET 
          population_size = GREATEST(0, population_size * 0.99),
          prosperity = GREATEST(0, prosperity - 1),
          stability = GREATEST(0, stability - 0.5)
        WHERE cell_id = $1
      `, [event.target_cell_id]);
    }
  }

  private async applyPlague(event: any) {
    if (event.target_cell_id) {
      await db.query(`
        UPDATE populations SET population_size = GREATEST(0, population_size * 0.95)
        WHERE cell_id = $1
      `, [event.target_cell_id]);
    }
  }

  private async generateRandomEvent() {
    const events = ['golden_age', 'resource_discovery', 'natural_disaster'];
    const eventType = events[Math.floor(Math.random() * events.length)];
    
    // Get a random civilization
    const civs = await db.query('SELECT id FROM civilizations WHERE world_id = $1', [this.worldId]);
    if (civs.rows.length === 0) return;
    
    const targetCiv = civs.rows[Math.floor(Math.random() * civs.rows.length)];
    
    await db.query(`
      INSERT INTO events (world_id, type, scope, target_civ_id, start_tick, end_tick, is_active)
      VALUES ($1, $2, 'civilization', $3, $4, $5, true)
    `, [this.worldId, eventType, targetCiv.id, this.currentTick, this.currentTick + TICKS_PER_YEAR * 10]);

    this.io.emit('newEvent', {
      type: eventType,
      target: targetCiv.id,
      year: this.currentYear
    });
  }

  private async resolveExperiments() {
    const pending = await db.query(
      "SELECT * FROM experiments WHERE status = 'pending' AND world_id = $1",
      [this.worldId]
    );

    for (const exp of pending.rows) {
      await this.executeExperiment(exp);
    }
  }

  async executeExperiment(experiment: any) {
    let result: any = { success: false };
    
    try {
      switch (experiment.category) {
        case 'biological':
          result = await this.executeBiologicalExperiment(experiment);
          break;
        case 'technological':
          result = await this.executeTechnologicalExperiment(experiment);
          break;
        case 'sociopolitical':
          result = await this.executeSociopoliticalExperiment(experiment);
          break;
        case 'catastrophic':
          result = await this.executeCatastrophicExperiment(experiment);
          break;
        case 'playful':
          result = await this.executePlayfulExperiment(experiment);
          break;
      }

      await db.query(
        "UPDATE experiments SET status = 'resolved', result = $1, resolved_at = NOW() WHERE id = $2",
        [JSON.stringify(result), experiment.id]
      );

      // Update player reputation based on experiment outcome
      await this.updatePlayerReputation(experiment.player_id, experiment.category, result);

      this.io.emit('experimentResolved', {
        experiment_id: experiment.id,
        player_id: experiment.player_id,
        type: experiment.type,
        result
      });

    } catch (error) {
      console.error('Experiment execution error:', error);
      await db.query(
        "UPDATE experiments SET status = 'failed', result = $1, resolved_at = NOW() WHERE id = $2",
        [JSON.stringify({ error: 'Execution failed' }), experiment.id]
      );
    }
  }

  private async executeBiologicalExperiment(exp: any) {
    switch (exp.type) {
      case 'seed_species':
        // Add a new species to a cell
        const speciesId = exp.parameters.species_id;
        await db.query(`
          INSERT INTO cell_species (cell_id, species_id, population_density)
          VALUES ($1, $2, 100)
          ON CONFLICT (cell_id, species_id) DO UPDATE SET population_density = cell_species.population_density + 100
        `, [exp.target_id, speciesId]);
        return { success: true, message: 'Species introduced successfully' };

      case 'pandemic':
        // Reduce populations in target area
        const lethality = exp.parameters.lethality || 0.1;
        await db.query(`
          UPDATE populations SET population_size = GREATEST(0, population_size * (1 - $1))
          WHERE cell_id = $2
        `, [lethality, exp.target_id]);
        return { success: true, casualties: lethality * 100 + '% mortality' };

      default:
        return { success: false, message: 'Unknown biological experiment' };
    }
  }

  private async executeTechnologicalExperiment(exp: any) {
    switch (exp.type) {
      case 'uplift':
        await db.query(`
          UPDATE populations SET 
            tech_level = LEAST(9, tech_level + 1),
            stability = GREATEST(0, stability - 10),
            education = LEAST(100, education + 20)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Technology uplifted!' };

      case 'gift_knowledge':
        await db.query(`
          UPDATE populations SET education = LEAST(100, education + 30)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Knowledge gifted' };

      default:
        return { success: false, message: 'Unknown tech experiment' };
    }
  }

  private async executeSociopoliticalExperiment(exp: any) {
    switch (exp.type) {
      case 'ideology_nudge':
        const axis = exp.parameters.axis || 'collectivism';
        const direction = exp.parameters.direction || 5;
        await db.query(`
          UPDATE populations SET ideology_${axis} = GREATEST(0, LEAST(100, ideology_${axis} + $1))
          WHERE cell_id = $2
        `, [direction, exp.target_id]);
        return { success: true, message: `Ideology shifted toward ${axis}` };

      case 'prophetic_vision':
        await db.query(`
          UPDATE populations SET 
            ideology_tradition = GREATEST(0, LEAST(100, ideology_tradition + 15)),
            stability = GREATEST(0, stability - 5)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Visions have been sent' };

      default:
        return { success: false, message: 'Unknown sociopolitical experiment' };
    }
  }

  private async executeCatastrophicExperiment(exp: any) {
    switch (exp.type) {
      case 'meteor':
        await db.query(`
          UPDATE populations SET 
            population_size = GREATEST(0, population_size * 0.3),
            stability = 0,
            prosperity = 0
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Impact successful. Destruction: catastrophic.' };

      case 'supervolcano':
        // Affects target and neighbors
        await db.query(`
          UPDATE populations SET 
            population_size = GREATEST(0, population_size * 0.5),
            prosperity = GREATEST(0, prosperity - 50)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Volcanic winter initiated' };

      default:
        return { success: false, message: 'Unknown catastrophic experiment' };
    }
  }

  private async executePlayfulExperiment(exp: any) {
    switch (exp.type) {
      case 'crop_circles':
        await db.query(`
          UPDATE populations SET 
            ideology_tradition = LEAST(100, ideology_tradition + 5),
            stability = GREATEST(0, stability - 2)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'Mysterious patterns appeared. Locals are confused.' };

      case 'miracle':
        await db.query(`
          UPDATE populations SET 
            prosperity = LEAST(100, prosperity + 10),
            ideology_tradition = LEAST(100, ideology_tradition + 10)
          WHERE cell_id = $1
        `, [exp.target_id]);
        return { success: true, message: 'A miracle occurred! Faith increased.' };

      default:
        return { success: false, message: 'Unknown playful experiment' };
    }
  }

  private async updatePlayerReputation(playerId: string, category: string, result: any) {
    if (!result.success) return;

    let benevolence = 0, mischief = 0, curiosity = 1;

    switch (category) {
      case 'biological':
        curiosity += 2;
        break;
      case 'technological':
        benevolence += 2;
        break;
      case 'catastrophic':
        mischief += 5;
        benevolence -= 2;
        break;
      case 'playful':
        mischief += 2;
        curiosity += 2;
        break;
      case 'sociopolitical':
        curiosity += 1;
        break;
    }

    await db.query(`
      UPDATE players SET 
        benevolence = benevolence + $1,
        mischief = mischief + $2,
        curiosity = curiosity + $3
      WHERE id = $4
    `, [benevolence, mischief, curiosity, playerId]);
  }

  private async createSnapshot() {
    const stats = await this.getWorldStats();
    
    await db.query(`
      INSERT INTO world_snapshots (world_id, tick, year, total_population, num_civilizations, avg_tech_level)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [this.worldId, this.currentTick, this.currentYear, stats.totalPopulation, stats.numCivilizations, stats.avgTechLevel]);
  }

  private async getWorldStats() {
    const result = await db.query(`
      SELECT 
        SUM(p.population_size) as total_population,
        COUNT(DISTINCT p.civilization_id) as num_civilizations,
        AVG(p.tech_level) as avg_tech_level,
        AVG(p.stability) as avg_stability,
        AVG(p.prosperity) as avg_prosperity
      FROM populations p
      JOIN cells c ON p.cell_id = c.id
      WHERE c.world_id = $1
    `, [this.worldId]);

    return {
      totalPopulation: result.rows[0].total_population || 0,
      numCivilizations: result.rows[0].num_civilizations || 0,
      avgTechLevel: parseFloat(result.rows[0].avg_tech_level) || 0,
      avgStability: parseFloat(result.rows[0].avg_stability) || 0,
      avgProsperity: parseFloat(result.rows[0].avg_prosperity) || 0
    };
  }

  getState() {
    return {
      tick: this.currentTick,
      year: this.currentYear,
      worldId: this.worldId,
      isRunning: this.isRunning
    };
  }
}
