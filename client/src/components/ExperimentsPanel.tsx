import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useSocket } from '../hooks/useSocket'
import { X, Beaker, Zap, Brain, Flame, Sparkles } from 'lucide-react'

const EXPERIMENT_CATEGORIES = [
  { id: 'biological', name: 'Biological', icon: Beaker, color: 'text-green-400' },
  { id: 'technological', name: 'Tech', icon: Zap, color: 'text-blue-400' },
  { id: 'sociopolitical', name: 'Social', icon: Brain, color: 'text-purple-400' },
  { id: 'catastrophic', name: 'Catastrophic', icon: Flame, color: 'text-red-400' },
  { id: 'playful', name: 'Playful', icon: Sparkles, color: 'text-yellow-400' },
]

const EXPERIMENTS: Record<string, { name: string; cost: number; desc: string }[]> = {
  biological: [
    { name: 'seed_species', cost: 15, desc: 'Introduce new species' },
    { name: 'rewild', cost: 10, desc: 'Restore natural habitat' },
    { name: 'pandemic', cost: 50, desc: 'Release a disease' },
  ],
  technological: [
    { name: 'uplift', cost: 30, desc: 'Advance tech level' },
    { name: 'gift_knowledge', cost: 20, desc: 'Boost education' },
  ],
  sociopolitical: [
    { name: 'ideology_nudge', cost: 10, desc: 'Shift ideology' },
    { name: 'prophetic_vision', cost: 25, desc: 'Send visions' },
  ],
  catastrophic: [
    { name: 'meteor', cost: 100, desc: 'Meteor strike!' },
    { name: 'supervolcano', cost: 80, desc: 'Volcanic eruption' },
  ],
  playful: [
    { name: 'crop_circles', cost: 5, desc: 'Make crop circles' },
    { name: 'miracle', cost: 15, desc: 'Perform a miracle' },
  ],
}

export function ExperimentsPanel() {
  const [selectedCategory, setSelectedCategory] = useState('biological')
  const { user, selectedCellId, toggleExperiments } = useStore()
  const { submitExperiment } = useSocket()

  const handleExperiment = (type: string, cost: number) => {
    if (!selectedCellId) {
      alert('Select a cell on the globe first!')
      return
    }
    if (!user || user.experiment_points < cost) {
      alert('Not enough experiment points!')
      return
    }
    
    submitExperiment({
      category: selectedCategory,
      type,
      target_type: 'cell',
      target_id: selectedCellId,
    })
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-space-600">
        <h3 className="font-semibold text-white">🧪 Experiments</h3>
        <button
          onClick={toggleExperiments}
          className="p-1 rounded hover:bg-space-600 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {EXPERIMENT_CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-alien-purple text-white'
                  : 'bg-space-700 text-gray-400 hover:text-white'
              }`}
            >
              <Icon className={`w-3 h-3 ${cat.color}`} />
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Selected Cell Info */}
      <div className="mb-4 p-3 bg-space-700/50 rounded-lg">
        <p className="text-xs text-gray-400 mb-1">Target Cell</p>
        {selectedCellId ? (
          <p className="text-sm text-alien-green">✓ Cell selected</p>
        ) : (
          <p className="text-sm text-yellow-400">⚠ Click a cell on the globe</p>
        )}
      </div>

      {/* Experiments List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {EXPERIMENTS[selectedCategory]?.map((exp) => (
          <button
            key={exp.name}
            onClick={() => handleExperiment(exp.name, exp.cost)}
            disabled={!selectedCellId || !user || user.experiment_points < exp.cost}
            className="w-full p-3 bg-space-700/50 hover:bg-space-600 rounded-lg text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-white text-sm">
                {exp.name.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-alien-yellow flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {exp.cost}
              </span>
            </div>
            <p className="text-xs text-gray-400">{exp.desc}</p>
          </button>
        ))}
      </div>

      {/* Points Display */}
      <div className="mt-4 pt-3 border-t border-space-600 flex items-center justify-between">
        <span className="text-sm text-gray-400">Your Points</span>
        <span className="text-lg font-bold text-alien-yellow">
          {user?.experiment_points || 0} EP
        </span>
      </div>
    </div>
  )
}
