import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useSocket } from '../hooks/useSocket'
import { Globe } from '../components/Globe'
import { ChatPanel } from '../components/ChatPanel'
import { ExperimentsPanel } from '../components/ExperimentsPanel'
import { CellInfoPanel } from '../components/CellInfoPanel'
import { TopBar } from '../components/TopBar'
import { OnlinePlayersOrbit } from '../components/OnlinePlayersOrbit'
import { 
  MessageSquare, 
  FlaskConical, 
  Info, 
  Globe2,
  Users
} from 'lucide-react'

// Use VITE_API_URL if set, otherwise empty string (same origin)
const API_URL = import.meta.env.VITE_API_URL || ''

export function GamePage() {
  const { 
    token, 
    showChat, 
    showExperiments, 
    showCellInfo,
    toggleChat,
    toggleExperiments,
    toggleCellInfo,
    setCells,
    setPopulations,
    setCivilizations,
    onlinePlayers
  } = useStore()

  const [loading, setLoading] = useState(true)
  const { connect, disconnect } = useSocket()

  useEffect(() => {
    async function loadWorldData() {
      try {
        const headers = { 'Authorization': `Bearer ${token}` }
        
        const [cellsRes, popsRes, civsRes] = await Promise.all([
          fetch(`${API_URL}/api/world/cells`, { headers }),
          fetch(`${API_URL}/api/world/populations`, { headers }),
          fetch(`${API_URL}/api/world/civilizations`, { headers })
        ])

        if (cellsRes.ok && popsRes.ok && civsRes.ok) {
          const cells = await cellsRes.json()
          const populations = await popsRes.json()
          const civilizations = await civsRes.json()
          
          setCells(cells)
          setPopulations(populations)
          setCivilizations(civilizations)
        }
      } catch (error) {
        console.error('Failed to load world data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWorldData()
  }, [token, setCells, setPopulations, setCivilizations])

  // Connect to socket for real-time updates
  useEffect(() => {
    if (token) {
      connect(token)
      return () => disconnect()
    }
  }, [token, connect, disconnect])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-space-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-alien-purple/30 border-t-alien-purple rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading the universe...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-space-900">
      {/* Top Bar */}
      <TopBar />

      {/* 3D Globe - Main View */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Globe />
      </div>

      {/* Orbiting Players Visualization */}
      <OnlinePlayersOrbit />

      {/* Side Panels */}
      {showChat && (
        <div className="absolute left-4 bottom-4 z-20 w-80">
          <ChatPanel />
        </div>
      )}

      {showExperiments && (
        <div className="absolute right-4 top-20 bottom-4 z-20 w-80">
          <ExperimentsPanel />
        </div>
      )}

      {showCellInfo && (
        <div className="absolute right-4 bottom-4 z-20 w-80">
          <CellInfoPanel />
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="absolute left-4 top-20 z-20 flex flex-col gap-2">
        <button
          onClick={toggleChat}
          className={`p-3 rounded-xl transition-all ${
            showChat ? 'bg-alien-purple text-white' : 'bg-space-700/80 text-gray-400 hover:text-white'
          }`}
          title="Toggle Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        
        <button
          onClick={toggleExperiments}
          className={`p-3 rounded-xl transition-all ${
            showExperiments ? 'bg-alien-purple text-white' : 'bg-space-700/80 text-gray-400 hover:text-white'
          }`}
          title="Toggle Experiments"
        >
          <FlaskConical className="w-5 h-5" />
        </button>
        
        <button
          onClick={toggleCellInfo}
          className={`p-3 rounded-xl transition-all ${
            showCellInfo ? 'bg-alien-purple text-white' : 'bg-space-700/80 text-gray-400 hover:text-white'
          }`}
          title="Toggle Cell Info"
        >
          <Info className="w-5 h-5" />
        </button>

        <div className="my-2 h-px bg-space-500" />

        <div className="p-3 rounded-xl bg-space-700/80 flex items-center gap-2" title="Online Players">
          <Users className="w-5 h-5 text-alien-green" />
          <span className="text-sm text-white">{onlinePlayers.length}</span>
        </div>
      </div>

      {/* Globe Controls Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-space-800/80 backdrop-blur rounded-full text-sm text-gray-400">
          <Globe2 className="w-4 h-4" />
          <span>Drag to rotate • Scroll to zoom • Click cells to inspect</span>
        </div>
      </div>
    </div>
  )
}
