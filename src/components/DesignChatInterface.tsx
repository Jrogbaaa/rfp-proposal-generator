import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../utils/llmService'
import type { ProposalData, ExpandedContent, DesignConfig } from '../types/proposal'
import { iterateDesign } from '../utils/llmService'
import GoogleSlidesButton from './GoogleSlidesButton'

interface DesignChatInterfaceProps {
  currentDesignConfig: DesignConfig
  onDesignConfigUpdated: (config: DesignConfig) => void
  parsedData: Partial<ProposalData> | null
  briefText: string
  expansions: ExpandedContent | null
  onSlidesSuccess: (url: string) => void
}

const DESIGN_SUGGESTED_PROMPTS = [
  'Make it more corporate',
  'Tech-forward palette',
  'Sustainable / green theme',
  'Classic professional style',
  'Modern and clean',
  'Bold enterprise style',
]

const THEME_LABELS: Record<string, string> = {
  'navy-gold': 'Navy & Gold',
  'slate-blue': 'Slate & Blue',
  'forest-green': 'Forest Green',
}

export default function DesignChatInterface({
  currentDesignConfig,
  onDesignConfigUpdated,
  parsedData,
  briefText,
  expansions,
  onSlidesSuccess,
}: DesignChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: `Hi! I can help you choose the right visual style for this deck. The current theme is **${THEME_LABELS[currentDesignConfig.colorTheme] || currentDesignConfig.colorTheme}**. Ask me to try a different look, or pick one of the suggestions below.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const { reply, designConfig } = await iterateDesign(
        currentDesignConfig,
        text.trim(),
        messages
      )

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])

      if (designConfig) {
        onDesignConfigUpdated(designConfig)
      }
    } catch (err) {
      console.error('[DesignChatInterface] Error:', err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [currentDesignConfig, messages, isLoading, onDesignConfigUpdated])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Theme badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-navy-400">Current theme:</span>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-navy-100 text-navy-700 border border-navy-200">
          {THEME_LABELS[currentDesignConfig.colorTheme] || currentDesignConfig.colorTheme}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 border border-navy-200">
                  <svg className="w-3.5 h-3.5 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2 2 4-4" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-navy-700 text-cream-100 rounded-tr-sm'
                    : 'bg-cream-100 text-navy-800 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.text.split('**').map((part, j) =>
                  j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 border border-navy-200">
              <svg className="w-3.5 h-3.5 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2 2 4-4" />
              </svg>
            </div>
            <div className="bg-cream-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-navy-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {DESIGN_SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-navy-300 text-navy-600 hover:bg-navy-50 hover:border-navy-400 transition-colors disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end border-t border-cream-300 pt-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for a design change… (e.g. 'make it feel more modern')"
          disabled={isLoading}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-cream-400 bg-white px-4 py-3 text-sm text-navy-800 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent disabled:opacity-50 transition"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-navy-800 text-white flex items-center justify-center hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Export section */}
      <div className="border-t border-cream-300 pt-4 mt-4">
        <p className="text-xs text-navy-400 mb-3 text-center">Happy with the design? Create your deck.</p>
        <GoogleSlidesButton
          data={parsedData}
          briefText={briefText}
          isEmpty={!briefText.trim()}
          preGeneratedContent={expansions}
          designConfig={currentDesignConfig}
          onSuccess={onSlidesSuccess}
        />
      </div>
    </div>
  )
}
