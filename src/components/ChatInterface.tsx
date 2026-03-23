import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../utils/llmService'
import type { ProposalData, ExpandedContent, BrandVoiceProfile } from '../types/proposal'
import { iterateProposalContent } from '../utils/llmService'

interface ChatInterfaceProps {
  briefText: string
  parsedData: Partial<ProposalData>
  currentExpansions: ExpandedContent | null
  onExpansionsUpdated: (expansions: ExpandedContent) => void
  onLoadingChange?: (loading: boolean) => void
  brandVoice?: BrandVoiceProfile
}

const SUGGESTED_PROMPTS = [
  { label: 'More concise', icon: '✂' },
  { label: 'Stronger ROI', icon: '📈' },
  { label: 'Formal tone', icon: '🎩' },
  { label: 'More persuasive', icon: '💪' },
  { label: 'Add urgency', icon: '⚡' },
  { label: 'Add metrics', icon: '📊' },
]

const BotAvatar = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => {
  const dims = size === 'md' ? 'w-8 h-8' : 'w-6 h-6'
  const iconDims = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <div className={`${dims} rounded-lg bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <svg className={`${iconDims} text-navy-800`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </svg>
    </div>
  )
}

export default function ChatInterface({
  briefText,
  parsedData,
  currentExpansions,
  onExpansionsUpdated,
  onLoadingChange,
  brandVoice,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: `I've reviewed the brief for **${parsedData.client?.company || 'your client'}**. Tell me how to refine the tone, tighten the copy, or shift the focus — slides update live.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasInteracted = useRef(false)

  useEffect(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = messages.length > 1
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const handleAutoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    onLoadingChange?.(true)

    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const { reply, updatedExpansions } = await iterateProposalContent(
        briefText,
        parsedData,
        currentExpansions,
        text.trim(),
        messages,
        brandVoice
      )

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])

      if (updatedExpansions) {
        onExpansionsUpdated(updatedExpansions)
      }
    } catch (err) {
      console.error('[ChatInterface] Error:', err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }, [briefText, parsedData, currentExpansions, messages, isLoading, onExpansionsUpdated, onLoadingChange, brandVoice])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    handleAutoResize(e.target)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-cream-300/80">
        <BotAvatar size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy-800 tracking-tight">AI Copywriter</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              isLoading
                ? 'bg-gold-100 text-gold-700'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-gold-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isLoading ? 'Writing' : 'Ready'}
            </span>
          </div>
          <p className="text-[11px] text-navy-400 truncate">Edits update slides in real time</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent' }}>
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
                <div className="flex-shrink-0 mr-2 mt-0.5">
                  <BotAvatar />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-navy-700 text-cream-100 rounded-tr-sm'
                    : 'bg-white text-navy-800 rounded-tl-sm shadow-sm border border-cream-300/60'
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
            <div className="flex-shrink-0 mr-2 mt-0.5">
              <BotAvatar />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-cream-300/60">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gold-500"
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

      {/* Suggested prompts -- horizontal scroll, always compact */}
      {messages.length <= 1 && (
        <div className="py-2 -mx-1">
          <div className="flex gap-1.5 overflow-x-auto pb-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {SUGGESTED_PROMPTS.map(({ label, icon }) => (
              <button
                key={label}
                onClick={() => sendMessage(label)}
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-white border border-cream-400 text-navy-600 hover:border-gold-400 hover:bg-gold-50 hover:text-navy-800 transition-all disabled:opacity-40 shadow-sm"
                aria-label={`Suggest: ${label}`}
                tabIndex={0}
              >
                <span className="text-xs">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area -- single-row auto-expand with inline send */}
      <div className="relative mt-auto pt-2">
        <div className="flex items-end gap-0 rounded-xl border border-cream-400 bg-white focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-400/30 transition-all shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Tell me how to change the slides..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-transparent pl-3.5 pr-2 py-2.5 text-[13px] text-navy-800 placeholder-navy-400 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            aria-label="Chat message input"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 m-1.5 w-8 h-8 rounded-lg bg-navy-800 text-white flex items-center justify-center hover:bg-navy-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
            tabIndex={0}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
