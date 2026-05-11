import { useState, useEffect, useRef, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SITE_PASSWORD = 'PARA123'
const STORAGE_KEY = 'rfp_site_unlocked'

interface PasswordGateProps {
  children: React.ReactNode
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isUnlocked && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isUnlocked])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password === SITE_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // sessionStorage might be unavailable (incognito quotas, etc.) — silently ignore.
      }
      setIsUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setShake(true)
      setPassword('')
      setTimeout(() => setShake(false), 500)
      inputRef.current?.focus()
    }
  }

  if (isUnlocked) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-800 relative overflow-hidden px-6">
      {/* Subtle decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.06] via-transparent to-gold-500/[0.04] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gold-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="bg-cream-50 rounded-2xl shadow-2xl border border-cream-300 p-8 lg:p-10"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-navy-800 mb-5">
              <svg className="w-6 h-6 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400 mb-2">
              Restricted Access
            </p>
            <h1 className="font-display text-2xl lg:text-3xl text-navy-800 tracking-tight">
              Enter password to continue
            </h1>
            <p className="text-sm text-navy-500 mt-2">
              This site is password protected.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="site-password" className="sr-only">Password</label>
              <input
                ref={inputRef}
                id="site-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(false) }}
                autoComplete="current-password"
                placeholder="Password"
                aria-invalid={error}
                aria-describedby={error ? 'password-error' : undefined}
                className={`w-full px-4 py-3.5 rounded-xl bg-white border text-navy-800 placeholder-navy-300 text-base font-medium tracking-wide focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-400 focus:ring-red-300 focus:border-red-500'
                    : 'border-cream-400 focus:ring-gold-300/60 focus:border-gold-500'
                }`}
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    id="password-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-600 mt-2 font-medium"
                  >
                    Incorrect password. Please try again.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={!password}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-navy-800 text-cream-100 font-semibold text-base hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              Unlock
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-navy-400 mt-6">
          &copy; 2026 Paramount Proj
        </p>
      </motion.div>
    </div>
  )
}
