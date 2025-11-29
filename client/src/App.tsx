import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { useSocket } from './hooks/useSocket'
import { LoginPage } from './pages/LoginPage'
import { GamePage } from './pages/GamePage'

function App() {
  const { token, user } = useStore()
  const { connect, disconnect } = useSocket()

  useEffect(() => {
    if (token) {
      connect(token)
    }
    return () => {
      disconnect()
    }
  }, [token, connect, disconnect])

  return (
    <div className="w-full h-full">
      <Routes>
        <Route 
          path="/login" 
          element={token ? <Navigate to="/" replace /> : <LoginPage />} 
        />
        <Route 
          path="/" 
          element={token && user ? <GamePage /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </div>
  )
}

export default App
