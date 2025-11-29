import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useSocket } from '../hooks/useSocket'
import { Send, X } from 'lucide-react'

export function ChatPanel() {
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { chatMessages, toggleChat } = useStore()
  const { sendMessage } = useSocket()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      sendMessage('global', message.trim())
      setMessage('')
    }
  }

  return (
    <div className="card h-80 flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-space-600">
        <h3 className="font-semibold text-white">🌍 Global Chat</h3>
        <button
          onClick={toggleChat}
          className="p-1 rounded hover:bg-space-600 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {chatMessages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-4">
            No messages yet. Say hello! 👋
          </p>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-alien-purple/30 flex-shrink-0 flex items-center justify-center">
                <span className="text-sm">👽</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-alien-purple text-sm">
                    {msg.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300 break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="input flex-1 py-2 text-sm"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="btn btn-primary px-3"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
