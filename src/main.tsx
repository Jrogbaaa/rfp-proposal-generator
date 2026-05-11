import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PasswordGate from './components/PasswordGate'
import './index.css'
import { logError } from './utils/errorHandler'

// Global error handler - catches unhandled errors
window.onerror = (message, source, lineno, colno, error) => {
  logError(
    error || String(message),
    'runtime',
    { source, lineno, colno },
    'Global'
  )
  // Log to terminal via console (Vite forwards to terminal)
  console.error(`[RUNTIME ERROR] ${message}\n  at ${source}:${lineno}:${colno}`)
  return false // Let the error propagate
}

// Global promise rejection handler
window.onunhandledrejection = (event) => {
  logError(
    event.reason instanceof Error ? event.reason : String(event.reason),
    'runtime',
    { type: 'unhandledrejection' },
    'Global'
  )
  console.error('[UNHANDLED PROMISE]', event.reason)
}

// Dev mode banner
if (import.meta.env.DEV) {
  console.log(
    '%c🛠️ DevTools Active %c\nErrors will be captured and logged.\nClick the 🛠️ button in the app to view error log.',
    'background: #1a1f36; color: #c9a227; padding: 8px 12px; font-weight: bold; border-radius: 4px;',
    'color: #666; font-size: 11px;'
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </React.StrictMode>,
)
