import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProposalData } from '../types/proposal'

interface DocumentPreviewProps {
  data: Partial<ProposalData> | null
  isEmpty: boolean
}

type TabId = 'preview' | 'structure' | 'settings'

export default function DocumentPreview({ data, isEmpty }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('preview')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'structure', label: 'Structure' },
    { id: 'settings', label: 'Settings' },
  ]

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-cream-200 border-b border-cream-400">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${activeTab === tab.id
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-navy-500 hover:text-navy-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-navy-400">100%</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto preview-grid-bg p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-center"
            >
              <svg
                className="w-16 h-16 text-cream-400 mb-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h3 className="font-display text-xl text-navy-700 mb-2">
                No document yet
              </h3>
              <p className="text-sm text-navy-400 max-w-[280px]">
                Paste your proposal brief on the left and click Generate to create your formatted document.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="document"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-[600px] mx-auto"
            >
              <div className="preview-paper rounded-md p-8 lg:p-12 min-h-[700px]">
                {/* Document Header */}
                <div className="border-b-2 border-navy-800 pb-6 mb-8">
                  <h1 className="font-display text-2xl lg:text-3xl text-navy-800 mb-2">
                    {data?.project?.title || 'Untitled Proposal'}
                  </h1>
                  <p className="text-sm text-navy-500">
                    {data?.client?.company && `${data.client.company} • `}
                    {today}
                  </p>
                </div>

                {/* Client Section */}
                {data?.client && (data.client.firstName || data.client.email) && (
                  <div className="mb-8">
                    <h3 className="doc-section-title">Client Information</h3>
                    <div className="doc-text space-y-1">
                      {(data.client.firstName || data.client.lastName) && (
                        <p>{data.client.firstName} {data.client.lastName}</p>
                      )}
                      {data.client.email && <p className="text-navy-500">{data.client.email}</p>}
                      {data.client.company && <p>{data.client.company}</p>}
                    </div>
                  </div>
                )}

                {/* Project Details */}
                {data?.project && (data.project.duration || data.project.totalValue) && (
                  <div className="mb-8">
                    <h3 className="doc-section-title">Project Details</h3>
                    <div className="doc-text">
                      {data.project.duration && <p><strong>Timeline:</strong> {data.project.duration}</p>}
                      {data.project.totalValue && <p><strong>Investment:</strong> {data.project.totalValue}</p>}
                    </div>
                  </div>
                )}

                {/* Problems */}
                {data?.content?.problems && data.content.problems.some(p => p) && (
                  <div className="mb-8">
                    <h3 className="doc-section-title">Challenges We'll Address</h3>
                    <div className="doc-text">
                      <ul className="space-y-2">
                        {data.content.problems.filter(p => p).map((problem, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-gold-500 font-medium">{i + 1}.</span>
                            <span>{problem}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {data?.content?.benefits && data.content.benefits.some(b => b) && (
                  <div className="mb-8">
                    <h3 className="doc-section-title">Expected Outcomes</h3>
                    <div className="doc-text">
                      <ul className="space-y-2">
                        {data.content.benefits.filter(b => b).map((benefit, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-gold-500">✓</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-cream-300">
                  <p className="text-xs text-navy-400 text-center">
                    Proposal Preview • {today}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
