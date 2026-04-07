import { motion } from 'framer-motion'

interface LandingPageProps {
  onGetStarted: () => void
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const steps = [
  {
    number: '01',
    title: 'Upload your brief',
    description:
      'Drop a PDF or paste your RFP text. Gemini extracts the client, project, timeline, budget, and key themes automatically.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Refine with AI',
    description:
      'An AI copywriter chat helps you sharpen messaging, rewrite slides, and build a persuasion arc tailored to the prospect.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Export to Google Slides',
    description:
      'One click creates a presentation in your Google Drive. Share it with your team or present it directly.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    ),
  },
]

const scopes = [
  {
    name: 'Google Slides',
    scope: 'presentations',
    what: 'Create and write to presentations',
    why: 'We generate a polished slide deck from your brief and write each slide directly into a new Google Slides presentation in your account.',
  },
  {
    name: 'Google Drive',
    scope: 'drive.file',
    what: 'Access files created by this app only',
    why: 'We need per-file access so the newly created presentation appears in your Drive. We cannot see or modify any other files.',
  },
]

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-cream-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-cream-100/95 backdrop-blur-sm border-b border-cream-400 z-50">
        <div className="h-full max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Paramount" className="h-12 w-auto" />
            <span className="text-sm font-semibold text-navy-700 hidden sm:inline">Paramount Proj</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy.html" className="text-xs text-navy-400 hover:text-navy-600 transition-colors hidden sm:inline">Privacy</a>
            <a href="/terms.html" className="text-xs text-navy-400 hover:text-navy-600 transition-colors hidden sm:inline">Terms</a>
            <button
              onClick={onGetStarted}
              className="px-5 py-2 text-sm font-medium bg-navy-800 text-cream-100 hover:bg-navy-700 rounded-lg transition-colors"
            >
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — left-aligned, asymmetric */}
      <section className="pt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 min-h-[calc(100dvh-4rem)] items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="py-12 lg:py-0"
            >
              <motion.p
                variants={fadeUp}
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500 mb-4"
              >
                AI-Powered Proposal Generator
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="font-display text-4xl md:text-5xl lg:text-6xl text-navy-800 tracking-tight leading-none mb-6"
              >
                Turn briefs into
                <br />
                <span className="text-gold-500">presentation-ready</span>
                <br />
                proposals
              </motion.h1>
              <motion.p
                variants={fadeUp}
                className="text-base lg:text-lg text-navy-400 leading-relaxed max-w-[50ch] mb-8"
              >
                Paramount Proj reads your RFP brief, uses AI to craft a structured
                persuasion deck, and exports it directly to Google Slides — ready
                to present or share with your team.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <button
                  onClick={onGetStarted}
                  className="group flex items-center gap-2 px-7 py-4 rounded-xl bg-navy-800 text-cream-100 font-semibold text-base hover:bg-navy-700 transition-all shadow-card hover:shadow-card-hover active:scale-[0.98]"
                >
                  Get Started
                  <svg
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </motion.div>
            </motion.div>

            {/* Right: visual preview */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="hidden lg:flex items-center justify-center"
            >
              <div className="relative w-full max-w-md">
                {/* Stacked card effect */}
                <div className="absolute -top-3 -left-3 right-3 bottom-3 rounded-2xl bg-gold-100 border border-gold-200 rotate-[-2deg]" />
                <div className="absolute -top-1.5 -left-1.5 right-1.5 bottom-1.5 rounded-2xl bg-cream-200 border border-cream-400 rotate-[-1deg]" />
                <div className="relative rounded-2xl bg-white border border-cream-400 shadow-elevated p-8 space-y-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-cream-300">
                    <div className="w-10 h-10 rounded-full bg-navy-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-800 tracking-tight">Proposal Deck</p>
                      <p className="text-[10px] text-navy-400">13 slides generated</p>
                    </div>
                  </div>
                  {['Cover & Title', 'Market Challenge', 'Strategic Solution', 'Approach & Timeline'].map((slide, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-navy-300 w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                      <div className="flex-1 h-8 rounded-lg bg-cream-50 border border-cream-300 flex items-center px-3">
                        <span className="text-xs text-navy-600">{slide}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-[10px] text-navy-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ready to export
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-28 bg-cream-50 border-y border-cream-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500 mb-3">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl text-navy-800 tracking-tight mb-14">
              Three steps to a polished deck
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <motion.div key={step.number} variants={fadeUp} className="group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-navy-800 text-gold-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      {step.icon}
                    </div>
                    <span className="text-xs font-mono text-navy-300">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-navy-800 mb-2 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm text-navy-400 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Google API usage — transparency section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500 mb-3">
              Data &amp; Permissions
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl text-navy-800 tracking-tight mb-4">
              How we use Google APIs
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base text-navy-400 leading-relaxed max-w-[65ch] mb-12">
              Paramount Proj requests only the minimum permissions needed to create your
              presentation. We never access existing files in your Google Drive and
              we never store your Google credentials on our servers.
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scopes.map((s) => (
                <motion.div
                  key={s.scope}
                  variants={fadeUp}
                  className="rounded-xl bg-white border border-cream-300 p-6 shadow-card"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-cream-50 border border-cream-300 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-navy-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-800">{s.name}</p>
                      <p className="text-[10px] font-mono text-navy-300">{s.scope}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-300 mb-1">What we access</p>
                      <p className="text-sm text-navy-600">{s.what}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-300 mb-1">Why</p>
                      <p className="text-sm text-navy-400 leading-relaxed">{s.why}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div variants={fadeUp} className="mt-8 rounded-xl bg-navy-800 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-cream-100 mb-1">No data is sold or shared</p>
                <p className="text-xs text-navy-300 leading-relaxed max-w-[55ch]">
                  Your brief text is sent to Google Gemini solely for AI processing and is not
                  retained. Presentations are created in your own Google account. We do not
                  transfer your data to any third party. See our{' '}
                  <a href="/privacy.html" className="underline text-gold-400 hover:text-gold-300 transition-colors">
                    Privacy Policy
                  </a>{' '}
                  for full details.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-navy-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl md:text-4xl text-cream-100 tracking-tight mb-4"
            >
              Ready to build your next proposal?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base text-navy-300 mb-8 max-w-[50ch] mx-auto">
              Upload a brief, refine with AI, and export a polished deck in minutes.
            </motion.p>
            <motion.button
              variants={fadeUp}
              onClick={onGetStarted}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gold-500 text-navy-800 font-semibold text-base hover:bg-gold-400 transition-all shadow-card hover:shadow-card-hover active:scale-[0.98]"
            >
              Launch Paramount Proj
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-cream-300 bg-cream-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Paramount" className="h-8 w-auto opacity-60" />
            <span className="text-xs text-navy-400">&copy; 2026 Paramount Proj</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-navy-400">
            <a href="/privacy.html" className="hover:text-navy-600 transition-colors">Privacy Policy</a>
            <a href="/terms.html" className="hover:text-navy-600 transition-colors">Terms of Service</a>
            <a href="mailto:support@rfpparamount.com" className="hover:text-navy-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
