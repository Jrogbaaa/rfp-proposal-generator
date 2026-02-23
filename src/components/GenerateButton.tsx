import { motion } from 'framer-motion'

interface GenerateButtonProps {
  onClick: () => void
  isLoading: boolean
  disabled: boolean
  generatedUrl: string | null
  statusMessage?: string
}

export default function GenerateButton({
  onClick,
  isLoading,
  disabled,
  generatedUrl,
  statusMessage,
}: GenerateButtonProps) {
  if (generatedUrl) {
    return (
      <div className="space-y-3">
        <motion.a
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          href={generatedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-gold-500 hover:bg-gold-400 text-navy-800 font-semibold rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open in PandaDoc
        </motion.a>
        <button
          onClick={onClick}
          className="w-full text-sm text-navy-500 hover:text-navy-700 transition-colors"
        >
          Generate another
        </button>
      </div>
    )
  }

  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.01, y: -2 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.99 } : {}}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative w-full px-6 py-4 rounded-xl font-semibold text-base
        flex items-center justify-center gap-3 overflow-hidden
        transition-all duration-300
        ${disabled
          ? 'bg-cream-300 text-navy-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-navy-800 to-navy-700 text-cream-100 hover:shadow-elevated'
        }
      `}
    >
      {/* Shimmer effect on hover */}
      {!disabled && !isLoading && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      )}

      {isLoading ? (
        <>
          <div className="spinner" />
          <span>{statusMessage || 'Generating...'}</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>Generate PDF with PandaDoc</span>
        </>
      )}
    </motion.button>
  )
}
