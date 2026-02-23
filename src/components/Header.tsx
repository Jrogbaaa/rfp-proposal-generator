import { motion } from 'framer-motion'

interface HeaderProps {
  isConnected: boolean
}

export default function Header({ isConnected }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-cream-100/95 backdrop-blur-sm border-b border-cream-400 z-50">
      <div className="h-full px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <img src="/logo.svg" alt="Paramount" className="h-12 w-auto" />
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          {/* Connection Status */}
          <div className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
            ${isConnected
              ? 'bg-gold-100 text-gold-700'
              : 'bg-red-50 text-red-600'
            }
          `}>
            <span className={`
              w-1.5 h-1.5 rounded-full
              ${isConnected ? 'bg-gold-500' : 'bg-red-500'}
            `} />
            {isConnected ? 'Google Slides Ready' : 'Disconnected'}
          </div>

          {/* Template Button */}
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-600 hover:text-navy-800 hover:bg-cream-200 rounded-lg transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Templates
          </button>

          {/* History Button */}
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-600 hover:text-navy-800 hover:bg-cream-200 rounded-lg transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>

          {/* New Document Button */}
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-navy-800 text-cream-100 hover:bg-navy-700 rounded-lg transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New</span>
          </button>
        </motion.div>
      </div>
    </header>
  )
}
