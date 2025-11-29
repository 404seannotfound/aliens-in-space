<div align="center">

```
     ___      ___       ___      ___      ___      ___   
    /\  \    /\__\     /\  \    /\  \    /\__\    /\  \  
   /::\  \  /:/  /    _\:\  \  /::\  \  /:| _|_  /::\  \  
  /::\:\__\/:/__/    /\/::\__\/:/\:\__\/::|/\__\/\:\:\__\ 
  \/\::/  /\:\  \    \::/\/__/\:\/:/  /\/|::/  /\:\:\/__/ 
    /:/  /  \:\__\    \:\__\   \::/  /   |:/  /  \::/  /  
    \/__/    \/__/     \/__/    \/__/    \/__/    \/__/   
```

# 👽 ALIENS IN SPACE!! 🛸

### *A Persistent Multiplayer God-Game of Cosmic Proportions*

[![Status](https://img.shields.io/badge/Status-In_Development-blueviolet?style=for-the-badge&logo=rocket)](.)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)](https://threejs.org)

<br/>

```
                    🌍
               .-""""""-.
             .'          '.
            /   O    O    \        🛸 "Fascinating... let's see what
           :                :          happens if I give them fire."
           |                |       
           : ',          ,' :      👾 "Hold my space beer."
            \  '-......-'  /
             '.googoo    .'
               '-......-'
          🌑               🌕
```

<br/>

**Watch civilizations rise. Watch them fall. Help them along—or give them a gentle push off a cliff.**

</div>

---

> 🕐 **One real-time minute ≈ one in-game year.**  
> Populations rise, fall, starve, conquer, flourish, or vanish while you watch.

The server runs a continuous **cellular-automata-style simulation** of a globe populated with evolving civilizations, ecosystems, and ideologies. Authenticated players log in as alien observers orbiting the planet, see each other in space, chat, and perform "experiments" on the world below—uplifting civilizations, seeding new species, inducing famines, or dropping dinosaurs in the middle of somebody's carefully nurtured renaissance.

<details>
<summary>📦 <strong>Deployment Note</strong></summary>

> This project is intended to run on [Render](https://render.com) using a **blueprint**. A `render.xml` file will define the web service, background worker(s), and database. You don't need it to understand this README, but it will be referenced below.

</details>

---

## 📑 Table of Contents

<table>
<tr>
<td width="50%" valign="top">

### 🌌 Overview
- [🎯 High-Level Concept](#-high-level-concept)
- [🧬 Core Simulation](#-core-simulation)
  - [🌐 World & Time](#-world--time)
  - [🔴 Cells & Dots](#-cells--dots)
  - [👥 Populations](#-populations)
  - [🌲 Biomes & Fauna](#-biomes--fauna)
  - [⛏️ Resources & Scarcity](#%EF%B8%8F-resources--scarcity)
  - [📜 Ideologies & History](#-ideologies--history)

</td>
<td width="50%" valign="top">

### 🎮 Gameplay
- [👾 Alien Player Experience](#-alien-player-experience)
  - [🚀 Login & Orbit View](#-login--orbit-view)
  - [🧪 Experiments](#-experiments-interventions)
  - [💬 Social Features](#-social-features)
  - [📈 Player Progression](#-player-progression)
- [⚙️ Game Mechanics](#%EF%B8%8F-game-mechanics-in-detail)
  - [⏱️ Tick & Turn Mechanics](#%EF%B8%8F-tick--turn-mechanics)
  - [🤝 Conflict & Cooperation](#-conflict--cooperation-between-aliens)
  - [🎲 Events & Modifiers](#-events--modifiers)
  - [🏁 End States & Resets](#-end-states--resets)

</td>
</tr>
<tr>
<td colspan="2">

### 🔧 Technical
- [🏗️ System Architecture](#%EF%B8%8F-system-architecture) | [📦 Render Deployment](#-render-deployment-overview) | [💻 Development Setup](#-development-setup) | [🔮 Future Ideas](#-future-ideas)

</td>
</tr>
</table>

---

## 🎯 High-Level Concept

This project is a **website + database** that together run a persistent world simulation:

- The **database** keeps track of **state**:
  - The planet’s grid cells and their biomes.
  - Populations, cultures, species, resources, and ongoing modifiers.
  - Alien players, their actions, logs, chats, and experiment history.

- The **website**:
  - Renders an interactive **3D globe** you can spin, zoom, and inspect.
  - Shows **dots** (cells) that behave like a complex Game of Life.
  - Shows **population overlays** (density, tech level, ideology, etc.).
  - Hosts **player UI** for aliens in orbit (chat, actions, dashboards).

At its heart: a cellular automaton where each cell’s next state depends on itself, neighbors, global conditions, and alien interference—extended to model **populations, technology, ideologies, and ecosystems**.

---

## 🧬 Core Simulation

### 🌐 World & Time

- The planet is represented as a **discretized globe**:
  - For example, a hex or lat/long grid, each cell representing a region.
  - Each cell has a **biome**, **resource capacity**, and **climate traits**.

- **Time scale**:
  - **1 real-time minute ≈ 1 in-game year**.
  - Internally, the simulation can tick more frequently (e.g. once per second) and aggregate substeps into yearly outcomes.
  - Historical charts and timelines can be built from these ticks.

### 🔴 Cells & Dots

- Each cell is visually represented as a **dot** on the globe.
- Dots have Game-of-Life–like behavior:
  - **Alive/Dead** states extended to richer categories:
    - `Empty`, `Low Pop`, `Urbanized`, `Wasteland`, `Jungle`, `Industrial Hotspot`, etc.
  - Neighborhood rules determine:
    - Spread or contraction of populations.
    - Urban sprawl, desertification, regrowth.
    - Migration waves and refugee flows.

- Visual cues:
  - Color: population density / biome / tech level.
  - Flicker/pulse: instability, conflict, famine, or booming growth.

### 👥 Populations

Populations exist at the cell level but can form larger **civilizations** spanning multiple cells.

Each population has key attributes:

- `population_size`
- `tech_level` (Stone, Bronze, Industrial, Atomic, Digital, etc.)
- `ideology` (multi-dimensional vector: collectivism/individualism, authoritarian/liberal, etc.)
- `stability` (how prone to revolt/collapse)
- `prosperity` (economic health)
- `education`
- `birth_rate`, `death_rate`
- `war_like` / `cooperative` tendencies
- `resource_efficiency`
- `environmental_impact`

Populations can:

- **Grow** when food, water, and stability are plentiful.
- **Shrink** from famine, war, disease, or climate stress.
- **Split** into factions (e.g., ideological schisms).
- **Merge** via conquest, diplomacy, or cultural assimilation.
- **Go extinct** via catastrophe, environment collapse, or alien meddling.

### 🌲 Biomes & Fauna

Each cell has a biome:

- Examples: `Ocean`, `Desert`, `Forest`, `Grassland`, `Tundra`, `Wetland`, etc.
- Biomes define base:
  - Resource capacity.
  - Carrying capacity for populations.
  - Migration cost (how easy it is to move through).
  - Disease and risk modifiers.

**Fauna and species**:

- Species can be:
  - **Native** (evolutionary products of the simulation).
  - **Introduced by aliens** (e.g., “Drop in elephants,” “Re-seed dinosaurs”).
- Species have:
  - `trophic_level` (predator, herbivore, omnivore).
  - `reproduction_rate`, `lifespan`.
  - `habitat_preferences`.
  - `impact_on_populations` (food source, disease carrier, infrastructure destruction, etc.).

The interplay of biome + fauna + population yields:

- Overgrazing, deforestation, desertification.
- Ecological recovery if populations retreat.
- Extinction cascades if key species are removed.

### ⛏️ Resources & Scarcity

Regions track key resources:

- `food`
- `fresh_water`
- `minerals`
- `energy` (wood, coal, oil, renewables)
- `infrastructure` (roads, ports, networks)

Mechanics:

- High tech levels increase resource production but often deplete stocks faster.
- Trade routes allow surplus to flow, but wars or disasters can cut them off.
- **Resource exhaustion** can:
  - Drive populations into conflict.
  - Trigger migration waves.
  - Collapse infrastructure and tech levels (e.g., post-industrial crash).

### 📜 Ideologies & History

Ideology is a vector that influences decisions:

- Example axes:
  - `collectivism ↔ individualism`
  - `tradition ↔ innovation`
  - `authoritarianism ↔ liberalism`
  - `xenophobia ↔ cosmopolitanism`

Historical dynamics:

- **Bad decisions**:
  - High ideology weight toward “centralized control + bad information” can result in historical-scale mistakes:
    - Example: a regime deciding everyone must be a farmer → oversimplified policies → famine.
  - These are modeled as **policy events** with multi-year fallout.

- **Good decisions**:
  - Investments in education, research, infrastructure.
  - Improved resilience to disasters.

- Ideologies evolve from:
  - Neighboring civilizations.
  - Past events (wars, famines, prosperity).
  - Alien interventions (e.g., broadcasting propaganda or “divine revelations”).

---

## 👾 Alien Player Experience

### 🚀 Login & Orbit View

- Users sign up/log in via the website.
- Once logged in, the player avatar is an **alien in orbit**:
  - See the globe in the center.
  - Other online players appear as **orbiting markers** or ships.
  - Hover/select other aliens to see a short profile and recent actions.

### 🧪 Experiments (Interventions)

Aliens don’t directly control populations but influence them via **experiments** and **nudges**. Each experiment:

- Has a **cost** in a resource like “Attention” or “Experiment Points”.
- Has a **scope** (cell, region, civilization, global).
- Has **cooldowns** to prevent spam.
- Is logged in a visible **Experiment Log** so other players can see what happened.

<table>
<tr>
<td>

#### 🧬 Biological & Environmental
| Experiment | Effect |
|------------|--------|
| 🐘 Seed New Species | Introduce elephants, wolves, or alien-designed creatures |
| 🌳 Rewild Region | Revert farmland to forest, boost resilience |
| 🧫 Pandemic Trial | Introduce disease with tunable lethality |

</td>
<td>

#### ⚙️ Technological
| Experiment | Effect |
|------------|--------|
| ⬆️ Uplift Tech | Boost tech_level by one era (risky!) |
| ⬇️ Suppress Tech | Sabotage industry (ethically questionable) |
| 📚 Gift Knowledge | Targeted boost in education/science |

</td>
</tr>
<tr>
<td>

#### 🏛️ Socio-Political
| Experiment | Effect |
|------------|--------|
| 🧠 Ideology Nudge | Slightly push ideological vectors |
| 🔮 Prophetic Vision | Visions pushing toward peace or conquest |
| 🤪 Policy Insanity | Force catastrophic policies (e.g., "steel quotas") |

</td>
<td>

#### ☄️ Catastrophic
| Experiment | Effect |
|------------|--------|
| ☄️ Meteor Strike | *kaboom* |
| 🌋 Supervolcano | Regional devastation |
| 🌡️ Climate Event | Global heating or cooling |

</td>
</tr>
<tr>
<td colspan="2">

#### 🎉 Playful / Harassment
| Experiment | Effect |
|------------|--------|
| 👽 Random Crop Circles | Cosmetic, increases superstition |
| ✨ Localized Miracles | Water into wine, "holy" lights |
| 🐧 Teleport Species | Move penguins to desert, see what happens |

</td>
</tr>
</table>

Each experiment shows:

- Clear **before/after** indicators.
- Probabilistic outcomes so it’s not purely deterministic optimization.

### 💬 Social Features

- **Global orbit chat**: All aliens see live commentary about the world.
- **Regional chat**: Focus on a specific civilization or region.
- **Action feed**:
  - “User_X uplifted the North-Western Archipelago to Early Industrial.”
  - “User_Y seeded apex predators in the Central Plains.”
- Players can:
  - Spectate quietly.
  - Coordinate joint experiments.
  - Role-play as scientific observers, prankster gods, or benevolent guardians.

### 📈 Player Progression

To add long-term goals:

- **Reputation tracks**:
  - `Benevolence` (how much your experiments improved life).
  - `Mischief` (how much chaos you’ve caused).
  - `Curiosity` (diversity and novelty of your experiments).

- **Unlocks**:
  - New experiment types at higher reputation levels.
  - Cosmetic customizations for your alien avatar or orbit marker.
  - “Experiment Packs” specialized in ecology, politics, or technology.

- **Achievements**:
  - “Prevented global extinction for 500 years.”
  - “Triggered three different civilization collapses within a century.”
  - “Maintained a stable multi-civilization peace for 200 years.”

---

## ⚙️ Game Mechanics in Detail

### ⏱️ Tick & Turn Mechanics

- **Simulation tick**: e.g., once per real-time second.
  - Update all cells and populations based on:
    - Local state.
    - Neighbor states.
    - Global conditions (climate, ongoing disasters).
    - Active modifiers from events and experiments.

- **Year aggregation** (≈ 60 ticks):
  - Update “yearly” quantities:
    - Population growth/decline.
    - Tech progress.
    - Infrastructure changes.
    - Ideology drift.

- **Player interaction latency**:
  - When an experiment is triggered:
    - It’s recorded immediately.
    - Effects may play out over several ticks/years with visible progression.

### 🤝 Conflict & Cooperation Between Aliens

Multiple aliens can target the same region:

- **Priority system**:
  - Each experiment has a **type**, and some types combine, others override.
  - Example: Two aliens both uplift the same region → tech boost stacks but also massively increases instability.

- **Soft voting**:
  - If many aliens push similar interventions on a region, the simulation gently leans in that direction.
  - Opposing interventions partially cancel out.

- **Experiment interference**:
  - Some experiments explicitly **block** or **invert** others (e.g., “Shield Region” that reduces catastrophe impact).
  - This encourages coordinated play and rivalry.

### 🎲 Events & Modifiers

Random modifiers appear and vanish over time:

- **Local modifiers**:
  - `“Golden Age”` – Tech and prosperity up, but hubris increases.
  - `“Religious Revival”` – Ideology shifts, war likelihood up or down.
  - `“Resource Boom”` – Temporarily increased minerals but risk of resource curse.

- **Global modifiers**:
  - `“Sun Cycle”` – Slight variation in global energy and climate.
  - `“Cosmic Ray Spike”` – Increased mutation, unexpected tech leaps or biological changes.

Modifiers can:

- Be naturally generated by the simulation.
- Be triggered by aliens as part of experiments.
- Interact in complex ways (e.g., a Resource Boom during political instability might exacerbate corruption, not prosperity).

### 🏁 End States & Resets

Possible “soft endgame” conditions:

- **Full extinction**:
  - No sapient populations remain → aliens get a **Post-Mortem** view.
  - A new run can be seeded with different parameters.

- **Runaway singularity**:
  - A super-advanced civilization effectively “leaves the simulation” (uploading, ascension, etc.), altering global rules.

- **Stagnant equilibrium**:
  - Nothing major changes for a long period → simulation optionally introduces a “shake-up” event or invites players to vote on a world reset.

---

## 🏗️ System Architecture

### 🧱 Components

At a high level, the project consists of:

1. **Web Frontend**
   - Interactive 3D globe (e.g., using WebGL/Three.js).
   - Player UI (login, avatar, action panels, overlays).
   - Orbit and region chat.

2. **API Server**
   - REST/GraphQL endpoints for:
     - Player auth/session.
     - Querying world state (cells, populations, civilizations).
     - Submitting experiments.
     - Chat messages.
   - Validation and rate-limiting for player actions.

3. **Simulation Worker**
   - Background service running the simulation loop.
   - Periodically updates world state in the database.
   - Applies events, resolves wars, famines, migrations, etc.

4. **Database**
   - Stores persistent world state, historical snapshots, players, and logs.
   - Likely a relational DB (e.g., Postgres) given the structured data.

### Data Model Sketch

_Not exhaustive; just a conceptual guide._

- `players`
  - id, name, avatar, reputation metrics, creation date, last_seen

- `worlds`
  - id, name, parameters (seed, base climate, etc.)

- `cells`
  - id, world_id, lat, lon or grid coords
  - biome, base_resources, environment_state

- `populations`
  - id, cell_id, civilization_id
  - population_size, tech_level, ideology_vector, stability, prosperity
  - birth_rate, death_rate, resource_efficiency

- `civilizations`
  - id, name, color, dominant_ideology, capital_cell_id
  - relationships to other civilizations

- `species`
  - id, name, ecological traits, origin (native/introduced)

- `cell_species`
  - cell_id, species_id, population_density

- `events`
  - id, world_id, type, data (JSON), start_tick, end_tick

- `experiments`
  - id, player_id, target (cell/region/civ/global), type, parameters, created_at, resolved_at

- `chat_messages`
  - id, player_id, channel (global/region/world), text, created_at

- `ticks`
  - tick_number, timestamp, world_snapshot_metadata (for historical replay)

### Simulation Loop

The simulation worker:

1. Loads current world snapshot for the next tick.
2. For each cell:
   - Calculates local transitions based on neighbors and global modifiers.
   - Applies resource production/consumption.
   - Updates population sizes and health.
3. Resolves:
   - Conflicts and wars between neighboring populations.
   - Migration flows and trade.
   - Ideology shifts and policy decisions.
4. Applies **active events** and **aliens’ experiments**.
5. Writes updated state back to the database.

---

## Render Deployment Overview

This project is designed to be deployed on **Render** via a blueprint file **`render.xml`**.

The `render.xml` is expected to:

- Define a **Web Service**:
  - Runs the API server and serves the frontend.
  - Exposes HTTPS endpoint for users.

- Define a **Background Worker**:
  - Runs the simulation loop.
  - Scheduled or continuously running process.

- Define a **Database** (e.g., PostgreSQL):
  - Stores all persistent state.

- Set **Environment Variables**:
  - `DATABASE_URL` (or equivalent).
  - Auth secrets and keys.
  - Simulation tuning parameters (e.g., tick rate, world seed).

- Hook into **migrations**:
  - On deploy or via a job that runs database migrations.

You don’t need `render.xml` to start imagining or developing locally, but it will be the single source of truth for production configuration.

---

## 💻 Development Setup

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **3D Rendering** | Three.js + React Three Fiber |
| **Styling** | TailwindCSS |
| **State** | Zustand |
| **Backend** | Node.js + Express + TypeScript |
| **Real-time** | Socket.io |
| **Database** | PostgreSQL |
| **Auth** | JWT |

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 15+
- **npm** or **yarn**

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL

# 3. Create database
createdb aliens_in_space

# 4. Run migrations
npm run db:migrate

# 5. Seed the world
npm run db:seed

# 6. Start development servers
npm run dev
```

The app will be available at:
- 🌐 **Frontend**: http://localhost:5173
- 🔌 **API**: http://localhost:3001

### Environment Variables

Create `server/.env`:

```env
PORT=3001
DATABASE_URL=postgresql://localhost:5432/aliens_in_space
JWT_SECRET=your-secret-key-change-in-production
CLIENT_URL=http://localhost:5173
```

---

## 🔮 Future Ideas

- **Mobile App**: React Native version for on-the-go observation
- **VR Mode**: Immersive orbit experience with WebXR
- **AI Civilizations**: Let GPT-powered civilizations make decisions
- **Time Travel**: Replay historical moments
- **Achievements System**: Unlock special experiments
- **Seasonal Events**: Cosmic phenomena that affect the whole planet
- **Civilization Diplomacy**: Watch (or influence) inter-civ relations
- **Species Designer**: Create custom species to introduce

---

<div align="center">

## 🛸 Ready to Play God?

**Start the server, create an account, and begin your cosmic experiments!**

*Remember: With great power comes great responsibility... or great mischief. Your choice.* 👽

---

Made with 💜 and questionable ethics by alien observers everywhere

</div>