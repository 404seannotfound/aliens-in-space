import { useStore } from '../store/useStore'
import { LogOut, Calendar, Zap, Award } from 'lucide-react'

export function TopBar() {
  const { user, worldState, logout } = useStore()

  if (!user) return null

  const totalRep = user.reputation.benevolence + user.reputation.mischief + user.reputation.curiosity

  return (
    <div className="absolute top-0 left-0 right-0 z-30 p-4">
      <div className="flex items-center justify-between">
        {/* Logo & Year */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-space-800/80 backdrop-blur rounded-xl">
            <span className="text-2xl">👽</span>
            <div className="flex flex-col">
              <span className="font-bold text-white">Aliens in Space</span>
              <span className="text-xs text-gray-400">v0.3.0</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-space-800/80 backdrop-blur rounded-xl">
            <Calendar className="w-4 h-4 text-alien-purple" />
            <span className="text-white">Day {(worldState.currentTick / 2).toFixed(1)}</span>
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          {/* Experiment Points */}
          <div className="flex items-center gap-2 px-4 py-2 bg-space-800/80 backdrop-blur rounded-xl">
            <Zap className="w-4 h-4 text-alien-yellow" />
            <span className="text-white">{user.experiment_points} EP</span>
          </div>

          {/* Reputation */}
          <div className="flex items-center gap-2 px-4 py-2 bg-space-800/80 backdrop-blur rounded-xl">
            <Award className="w-4 h-4 text-alien-purple" />
            <span className="text-white">{totalRep} Rep</span>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 px-4 py-2 bg-space-800/80 backdrop-blur rounded-xl">
            <div className="w-8 h-8 rounded-full bg-alien-purple/30 flex items-center justify-center">
              <span className="text-lg">👽</span>
            </div>
            <span className="text-white font-medium">{user.username}</span>
            
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-space-600 transition-colors text-gray-400 hover:text-white"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
