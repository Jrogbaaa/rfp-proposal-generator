import { useRef } from 'react'
import { motion } from 'framer-motion'

interface BriefEditorProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

const PLACEHOLDER = `Describe your presentation, or paste a structured brief...

Free-form request:
  "Create a 10-slide showcase of Paramount's comedy portfolio for Q1 2026"
  "Build a cross-IP pitch deck highlighting the 2026 tentpole calendar"
  "Make a presentation about Paramount's reality TV lineup for a brand partnership"
  "Generate a general sales deck for a SaaS product launch"

Or paste a structured RFP brief:
  Project: [project name]
  Client: [first last], [email], [company]
  Timeline: [duration]
  Budget: [total value]

  Problems:
  - [challenge 1]
  - [challenge 2]

  Benefits:
  - [desired outcome 1]
  - [desired outcome 2]`

export default function BriefEditor({ value, onChange, onClear }: BriefEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onChange(text)
      textareaRef.current?.focus()
    } catch {
      textareaRef.current?.focus()
      document.execCommand('paste')
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
