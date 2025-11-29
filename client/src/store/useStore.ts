import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email: string
  avatar_type: string
  reputation: {
    benevolence: number
    mischief: number
    curiosity: number
  }
  experiment_points: number
}

interface Cell {
  id: string
  x: number
  y: number
  lat: number
  lon: number
  biome: string
  elevation: number
  temperature: number
  moisture: number
  food_capacity: number
  mineral_capacity: number
}

interface Population {
  id: string
  cell_id: string
  civilization_id: string
  population_size: number
  tech_level: number
  stability: number
  prosperity: number
  education: number
  civilization_name: string
  civilization_color: string
  x: number
  y: number
}

interface Civilization {
  id: string
  name: string
  color: string
  total_population: number
  num_cells: number
  avg_tech_level: number
}

interface OnlinePlayer {
  id: string
  username: string
  avatar_type: string
  position?: { lat: number; lon: number }
}

interface ChatMessage {
  id: string
  player_id: string
  username: string
  avatar_type: string
  message: string
  created_at: string
}

interface WorldState {
  currentYear: number
  currentTick: number
}

interface GameStore {
  // Auth
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
  
  // World data
  cells: Cell[]
  populations: Population[]
  civilizations: Civilization[]
  worldState: WorldState
  setCells: (cells: Cell[]) => void
  setPopulations: (populations: Population[]) => void
  setCivilizations: (civilizations: Civilization[]) => void
  setWorldState: (state: WorldState) => void
  
  // Selection
  selectedCellId: string | null
  setSelectedCellId: (id: string | null) => void
  
  // Online players
  onlinePlayers: OnlinePlayer[]
  setOnlinePlayers: (players: OnlinePlayer[]) => void
  addOnlinePlayer: (player: OnlinePlayer) => void
  removeOnlinePlayer: (id: string) => void
  updatePlayerPosition: (id: string, position: { lat: number; lon: number }) => void
  
  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  
  // UI
  showChat: boolean
  showExperiments: boolean
  showCellInfo: boolean
  toggleChat: () => void
  toggleExperiments: () => void
  toggleCellInfo: () => void
  
  // Overlay mode
  overlayMode: 'population' | 'tech' | 'prosperity' | 'stability' | 'biome'
  setOverlayMode: (mode: 'population' | 'tech' | 'prosperity' | 'stability' | 'biome') => void
}

export const useStore = create<GameStore>()(
  persist(
    (set) => ({
      // Auth
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      
      // World data
      cells: [],
      populations: [],
      civilizations: [],
      worldState: { currentYear: 0, currentTick: 0 },
      setCells: (cells) => set({ cells }),
      setPopulations: (populations) => set({ populations }),
      setCivilizations: (civilizations) => set({ civilizations }),
      setWorldState: (worldState) => set({ worldState }),
      
      // Selection
      selectedCellId: null,
      setSelectedCellId: (selectedCellId) => set({ selectedCellId }),
      
      // Online players
      onlinePlayers: [],
      setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
      addOnlinePlayer: (player) => set((state) => ({ 
        onlinePlayers: [...state.onlinePlayers.filter(p => p.id !== player.id), player] 
      })),
      removeOnlinePlayer: (id) => set((state) => ({ 
        onlinePlayers: state.onlinePlayers.filter(p => p.id !== id) 
      })),
      updatePlayerPosition: (id, position) => set((state) => ({
        onlinePlayers: state.onlinePlayers.map(p => 
          p.id === id ? { ...p, position } : p
        )
      })),
      
      // Chat
      chatMessages: [],
      addChatMessage: (message) => set((state) => ({ 
        chatMessages: [...state.chatMessages.slice(-99), message] 
      })),
      setChatMessages: (chatMessages) => set({ chatMessages }),
      
      // UI
      showChat: true,
      showExperiments: false,
      showCellInfo: false,
      toggleChat: () => set((state) => ({ showChat: !state.showChat })),
      toggleExperiments: () => set((state) => ({ showExperiments: !state.showExperiments })),
      toggleCellInfo: () => set((state) => ({ showCellInfo: !state.showCellInfo })),
      
      // Overlay mode
      overlayMode: 'population',
      setOverlayMode: (overlayMode) => set({ overlayMode }),
    }),
    {
      name: 'aliens-in-space-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
