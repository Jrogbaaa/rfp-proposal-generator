import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import ProgressStepper from './ProgressStepper';
import type { Step } from '../types/proposal';

interface LayoutProps {
  children: ReactNode;
  currentStep: Step;
  onStepClick?: (step: number) => void;
}

export default function Layout({ children, currentStep, onStepClick }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-cream-300 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-navy-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gold-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-navy-800">
                  Proposal Generator
                </h1>
                <p className="text-sm text-navy-500">
                  Create professional proposals in minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Stepper */}
      <div className="bg-white border-b border-cream-300">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <ProgressStepper currentStep={currentStep} onStepClick={onStepClick} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-cream-300 py-4">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm text-navy-400 text-center">
            Powered by PandaDoc API
          </p>
        </div>
      </footer>
    </div>
  );
}
