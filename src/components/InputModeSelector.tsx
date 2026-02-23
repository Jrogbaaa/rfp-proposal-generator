import { motion } from 'framer-motion';

interface InputModeSelectorProps {
  onSelect: (mode: 'structured' | 'transcript') => void;
}

export default function InputModeSelector({ onSelect }: InputModeSelectorProps) {
  const modes = [
    {
      id: 'structured' as const,
      title: 'Structured Input',
      description: 'Enter client information, problems, and benefits in organized fields',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      benefits: [
        'Perfect for organized data',
        'Field-by-field entry',
        'Instant validation',
      ],
    },
    {
      id: 'transcript' as const,
      title: 'Call Transcript',
      description: 'Paste a sales call transcript and extract the key information',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
      benefits: [
        'Great for call notes',
        'Bulk text entry',
        'Smart extraction',
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-3xl font-semibold text-navy-800 gold-accent inline-block">
          How would you like to start?
        </h2>
        <p className="mt-6 text-lg text-navy-600">
          Choose how you want to input your client information. You can always edit the details
          in the next step.
        </p>
      </div>

      {/* Mode Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(mode.id)}
            className="
              group text-left p-8 bg-white rounded-2xl border-2 border-cream-300
              shadow-card card-hover
              hover:border-gold-400 hover:shadow-card-hover
              focus:outline-none focus:border-gold-500 focus:ring-4 focus:ring-gold-100
              transition-all duration-300
            "
          >
            {/* Icon */}
            <div className="
              w-14 h-14 rounded-xl bg-cream-100 text-navy-600
              flex items-center justify-center
              group-hover:bg-gold-100 group-hover:text-gold-700
              transition-colors duration-300
            ">
              {mode.icon}
            </div>

            {/* Content */}
            <h3 className="mt-6 font-display text-xl font-semibold text-navy-800">
              {mode.title}
            </h3>
            <p className="mt-2 text-navy-600">
              {mode.description}
            </p>

            {/* Benefits */}
            <ul className="mt-6 space-y-2">
              {mode.benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-navy-500">
                  <svg
                    className="w-4 h-4 text-gold-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>

            {/* Arrow indicator */}
            <div className="
              mt-6 flex items-center gap-2 text-sm font-medium text-gold-600
              opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-2
              transition-all duration-300
            ">
              Get started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
