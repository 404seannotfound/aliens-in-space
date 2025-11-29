import { useStore } from '../store/useStore'

export function OnlinePlayersOrbit() {
  const { onlinePlayers, user } = useStore()

  // Position players in an arc around the screen edges
  const getPlayerPosition = (index: number, total: number) => {
    const angle = (index / Math.max(total, 1)) * Math.PI * 0.8 - Math.PI * 0.4
    const radius = 45 // percentage from center
    return {
      left: `${50 + radius * Math.cos(angle)}%`,
      top: `${15 + Math.abs(radius * Math.sin(angle)) * 0.5}%`,
    }
  }

  const otherPlayers = onlinePlayers.filter(p => p.id !== user?.id)

  if (otherPlayers.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {otherPlayers.map((player, index) => {
        const pos = getPlayerPosition(index, otherPlayers.length)
        return (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto animate-float"
            style={{ left: pos.left, top: pos.top, animationDelay: `${index * 0.5}s` }}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-space-700/80 backdrop-blur border-2 border-alien-purple/50 flex items-center justify-center shadow-lg shadow-alien-purple/20">
                <span className="text-xl">👽</span>
              </div>
              <span className="mt-1 text-xs text-white/80 bg-space-800/80 px-2 py-0.5 rounded-full">
                {player.username}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
