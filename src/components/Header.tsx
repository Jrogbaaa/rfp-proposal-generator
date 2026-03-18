import { motion } from 'framer-motion'

interface HeaderProps {
  isConnected: boolean
  onNew?: () => void
}

export default function Header({ isConnected, onNew }: HeaderProps) {
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
          <span className="text-sm font-semibold text-navy-700 hidden sm:inline">Paramount Proj</span>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          {/* Connection Status — only shown when connected */}
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gold-100 text-gold-700">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
              Google Slides Ready
            </div>
          )}

          {/* New Document Button */}
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-navy-800 text-cream-100 hover:bg-navy-700 rounded-lg transition-colors">
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
