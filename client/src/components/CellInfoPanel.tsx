import { useStore } from '../store/useStore'
import { X, Thermometer, Droplets, Mountain, Users, Cpu, TrendingUp, Shield } from 'lucide-react'

const TECH_LEVELS = ['Stone', 'Bronze', 'Iron', 'Medieval', 'Renaissance', 'Industrial', 'Modern', 'Atomic', 'Digital', 'Singularity']
const BIOME_EMOJIS: Record<string, string> = {
  ocean: '🌊', desert: '🏜️', forest: '🌲', grassland: '🌿',
  tundra: '❄️', wetland: '🌾', mountain: '⛰️', jungle: '🌴'
}

export function CellInfoPanel() {
  const { cells, populations, selectedCellId, toggleCellInfo } = useStore()

  const cell = cells.find(c => c.id === selectedCellId)
  const population = populations.find(p => p.cell_id === selectedCellId)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-space-600">
        <h3 className="font-semibold text-white">📍 Cell Info</h3>
        <button
          onClick={toggleCellInfo}
          className="p-1 rounded hover:bg-space-600 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!cell || typeof cell.lat !== 'number' || typeof cell.lon !== 'number' ? (
        <p className="text-gray-400 text-sm text-center py-4">
          Click a cell on the globe to see details
        </p>
      ) : (
        <div className="space-y-4">
          {/* Biome */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{BIOME_EMOJIS[cell.biome] || '🌍'}</span>
            <div>
              <p className="font-medium text-white capitalize">{cell.biome || 'Unknown'}</p>
              <p className="text-xs text-gray-400">
                ({cell.lat.toFixed(1)}°, {cell.lon.toFixed(1)}°)
              </p>
            </div>
          </div>

          {/* Environment Stats */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-space-700/50 rounded-lg">
              <Thermometer className="w-4 h-4 mx-auto mb-1 text-red-400" />
              <p className="text-xs text-gray-400">Temperature</p>
              <p className="text-sm text-white">{cell.temperature?.toFixed(1) || 'N/A'}°C</p>
            </div>
            <div className="p-2 bg-space-700/50 rounded-lg">
              <Mountain className="w-4 h-4 mx-auto mb-1 text-green-400" />
              <p className="text-xs text-gray-400">Food Capacity</p>
              <p className="text-sm text-white">{cell.food_capacity || 0}</p>
            </div>
          </div>

          {/* Population Info */}
          {population ? (
            <div className="space-y-3 pt-3 border-t border-space-600">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Civilization</span>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ backgroundColor: population.civilization_color + '30', color: population.civilization_color }}
                >
                  {population.civilization_name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-space-700/50 rounded-lg">
                  <Users className="w-4 h-4 text-alien-green" />
                  <div>
                    <p className="text-xs text-gray-400">Population</p>
                    <p className="text-sm text-white">{population.population_size.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-space-700/50 rounded-lg">
                  <Cpu className="w-4 h-4 text-alien-blue" />
                  <div>
                    <p className="text-xs text-gray-400">Tech Level</p>
                    <p className="text-sm text-white">{TECH_LEVELS[population.tech_level]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-space-700/50 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-alien-yellow" />
                  <div>
                    <p className="text-xs text-gray-400">Prosperity</p>
                    <p className="text-sm text-white">{population.prosperity}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-space-700/50 rounded-lg">
                  <Shield className="w-4 h-4 text-alien-purple" />
                  <div>
                    <p className="text-xs text-gray-400">Stability</p>
                    <p className="text-sm text-white">{population.stability}%</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-space-600 text-center">
              <p className="text-gray-500 text-sm">No population in this cell</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
