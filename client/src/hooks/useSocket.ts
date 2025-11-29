import { useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useStore } from '../store/useStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { 
    setOnlinePlayers, 
    addOnlinePlayer, 
    removeOnlinePlayer, 
    updatePlayerPosition,
    addChatMessage,
    setWorldState 
  } = useStore()

  const connect = useCallback((token: string) => {
    if (socketRef.current?.connected) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('🛸 Connected to server')
    })

    socket.on('disconnect', () => {
      console.log('📡 Disconnected from server')
    })

    socket.on('onlinePlayers', (players) => {
      setOnlinePlayers(players)
    })

    socket.on('playerJoined', (player) => {
      addOnlinePlayer(player)
      console.log(`👽 ${player.username} joined orbit`)
    })

    socket.on('playerLeft', (player) => {
      removeOnlinePlayer(player.id)
      console.log(`👋 ${player.username} left orbit`)
    })

    socket.on('playerMoved', ({ id, position }) => {
      updatePlayerPosition(id, position)
    })

    socket.on('chatMessage', (message) => {
      addChatMessage(message)
    })

    socket.on('tick', ({ tick, year }) => {
      console.log('📡 Tick received:', tick, 'Year:', year)
      setWorldState({ currentTick: tick, currentYear: year })
    })

    socket.on('yearUpdate', ({ year, stats }) => {
      console.log(`📅 Year ${year}:`, stats)
    })

    socket.on('techAdvancement', ({ tech_name }) => {
      console.log(`🔬 Tech advancement: ${tech_name}`)
    })

    socket.on('conflict', (data) => {
      console.log('⚔️ Conflict:', data)
    })

    socket.on('migration', (data) => {
      console.log('🚶 Migration:', data)
    })

    socket.on('experimentResolved', (data) => {
      console.log('🧪 Experiment resolved:', data)
    })

    socket.on('newEvent', (data) => {
      console.log('📢 New event:', data)
    })

    socketRef.current = socket
  }, [setOnlinePlayers, addOnlinePlayer, removeOnlinePlayer, updatePlayerPosition, addChatMessage, setWorldState])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }, [])

  const sendMessage = useCallback((channel: string, message: string, channel_id?: string) => {
    if (!socketRef.current) {
      console.error('❌ Socket not connected, cannot send message')
      return
    }
    console.log('💬 Sending message:', message)
    socketRef.current.emit('chatMessage', { channel, message, channel_id })
  }, [])

  const updatePosition = useCallback((lat: number, lon: number) => {
    socketRef.current?.emit('updatePosition', { lat, lon })
  }, [])

  const selectCell = useCallback((cellId: string) => {
    socketRef.current?.emit('selectCell', cellId)
  }, [])

  const submitExperiment = useCallback((data: {
    category: string
    type: string
    target_type: string
    target_id: string
    parameters?: any
  }) => {
    socketRef.current?.emit('submitExperiment', data)
  }, [])

  return {
    connect,
    disconnect,
    sendMessage,
    updatePosition,
    selectCell,
    submitExperiment,
    socket: socketRef.current
  }
}
