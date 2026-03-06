import { motion } from 'framer-motion';
import { STEPS, type Step } from '../types/proposal';

interface ProgressStepperProps {
  currentStep: Step;
  onStepClick?: (step: number) => void;
}

export default function ProgressStepper({ currentStep, onStepClick }: ProgressStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step Circle */}
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`
                relative flex items-center justify-center w-12 h-12 rounded-full
                font-display font-semibold text-lg
                transition-all duration-300
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                ${
                  isCompleted
                    ? 'bg-gold-500 text-navy-800'
                    : isCurrent
                    ? 'bg-navy-800 text-white ring-4 ring-gold-200'
                    : 'bg-cream-300 text-navy-400'
                }
              `}
            >
              {isCompleted ? (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </motion.svg>
              ) : (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Sans", system-ui, sans-serif', lineHeight: 1 }}>{step.number}</span>
              )}

              {/* Pulse animation for current step */}
              {isCurrent && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-navy-800"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </button>

            {/* Step Label */}
            <div className="ml-3 hidden sm:block">
              <p
                className={`
                  text-sm font-medium
                  ${isCurrent ? 'text-navy-800' : isCompleted ? 'text-gold-600' : 'text-navy-400'}
                `}
              >
                {step.label}
              </p>
              <p className="text-xs text-navy-400">
                {isCompleted ? 'Completed' : isCurrent ? 'In progress' : 'Pending'}
              </p>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="flex-1 mx-4 hidden sm:block">
                <div className="h-1 bg-cream-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gold-500"
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
