import { Response } from 'express';

// Store active debug clients (db-init.html pages that are listening)
const debugClients: Set<Response> = new Set();

export function addDebugClient(res: Response) {
  debugClients.add(res);
  
  // Remove client when connection closes
  res.on('close', () => {
    debugClients.delete(res);
  });
}

export function debugLog(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message
  };
  
  // Always log to console
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[level];
  
  console.log(`${emoji} [${timestamp}] ${message}`);
  
  // Send to all connected debug clients
  if (debugClients.size > 0) {
    const data = `data: ${JSON.stringify(logEntry)}\n\n`;
    debugClients.forEach(client => {
      try {
        client.write(data);
      } catch (err) {
        // Client disconnected, remove it
        debugClients.delete(client);
      }
    });
  }
}

export function getDebugClientCount(): number {
  return debugClients.size;
}
