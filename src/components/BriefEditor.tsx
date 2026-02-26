import { useRef } from 'react'
import { motion } from 'framer-motion'

interface BriefEditorProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

const PLACEHOLDER = `Paste your proposal brief here...

Format guide:
Project: [project name]
Client: [first last], [email], [company]
Timeline: [duration]
Budget: [total value]
Month 1 Investment: [amount]
Month 2 Investment: [amount]
Month 3 Investment: [amount]

Problems:
- [challenge 1]
- [challenge 2]
- [challenge 3]
- [challenge 4]

Benefits:
- [desired outcome 1]
- [desired outcome 2]
- [desired outcome 3]
- [desired outcome 4]`

export default function BriefEditor({ value, onChange, onClear }: BriefEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onChange(text)
      textareaRef.current?.focus()
    } catch (err) {
      console.error('Failed to read clipboard:', err)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Editor Area */}
      <div className="flex-1 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute inset-0 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={PLACEHOLDER}
            className="editor-textarea dark-scrollbar w-full h-full p-6"
            spellCheck={false}
          />
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]"
      >
        <span className="text-sm text-navy-400">
          <span className="font-medium text-cream-300">{value.length.toLocaleString()}</span>
          {' '}characters
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            disabled={!value}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-400 hover:text-cream-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>

          <button
            onClick={handlePaste}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/[0.06] text-cream-200 hover:bg-white/[0.1] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Paste
          </button>
        </div>
      </motion.div>
    </div>
  )
}
