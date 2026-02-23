import { motion } from 'framer-motion';
import type { ProblemsAndBenefits, ExpandedContent } from '../types/proposal';

interface ContentEditorProps {
  content: ProblemsAndBenefits;
  expanded: ExpandedContent;
  onExpandedChange: (updates: Partial<ExpandedContent>) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function ContentEditor({
  content,
  expanded,
  onExpandedChange,
  onSubmit,
  onBack,
}: ContentEditorProps) {
  const handleProblemExpansionChange = (index: number, value: string) => {
    const newExpansions = [...expanded.problemExpansions] as [string, string, string, string];
    newExpansions[index] = value;
    onExpandedChange({ problemExpansions: newExpansions });
  };

  const handleBenefitExpansionChange = (index: number, value: string) => {
    const newExpansions = [...expanded.benefitExpansions] as [string, string, string, string];
    newExpansions[index] = value;
    onExpandedChange({ benefitExpansions: newExpansions });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-2xl font-semibold text-navy-800 gold-accent inline-block">
          Review & Edit Content
        </h2>
        <p className="mt-4 text-navy-600">
          We've expanded your problems and benefits into persuasive copy. Review and edit as needed.
        </p>
      </div>

      {/* Tone Guidelines */}
      <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gold-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="font-medium text-gold-800">Tone Guidelines</h4>
            <ul className="mt-1 text-sm text-gold-700 space-y-1">
              <li>• Use direct "you" language (not third-person or passive voice)</li>
              <li>• Focus on revenue impact and dollar amounts where possible</li>
              <li>• Be specific and actionable rather than abstract</li>
              <li>• Think "revenue ops" mindset - quantify business impact</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Problems Section */}
      <div className="bg-white rounded-2xl p-8 shadow-card">
        <h3 className="font-display text-xl font-semibold text-navy-800 mb-6 gold-accent inline-block">
          Problem Statements
        </h3>
        <p className="text-navy-500 mb-6 -mt-2">
          Each problem has been expanded into a strategic paragraph focusing on revenue impact.
        </p>

        <div className="space-y-6">
          {content.problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border border-cream-300 rounded-xl overflow-hidden"
            >
              {/* Original Problem */}
              <div className="bg-cream-100 px-4 py-3 border-b border-cream-300">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-navy-800 text-white text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-navy-700">Original:</span>
                  <span className="text-sm text-navy-600">{problem || '(empty)'}</span>
                </div>
              </div>

              {/* Expanded Version */}
              <div className="p-4">
                <label className="block text-sm font-medium text-navy-700 mb-2">
                  Expanded Version
                </label>
                <textarea
                  value={expanded.problemExpansions[index]}
                  onChange={(e) => handleProblemExpansionChange(index, e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-cream-300 rounded-lg
                           text-navy-800 placeholder-navy-300
                           transition-all duration-200
                           focus:border-gold-500 focus:ring-2 focus:ring-gold-200
                           resize-none"
                  placeholder="Expanded problem statement..."
                />
                <p className="mt-2 text-xs text-navy-400">
                  {expanded.problemExpansions[index].length} characters • Aim for 150-250 characters
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-white rounded-2xl p-8 shadow-card">
        <h3 className="font-display text-xl font-semibold text-navy-800 mb-6 gold-accent inline-block">
          Benefit Statements
        </h3>
        <p className="text-navy-500 mb-6 -mt-2">
          Each benefit has been expanded into an implementation-focused paragraph emphasizing ROI.
        </p>

        <div className="space-y-6">
          {content.benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="border border-cream-300 rounded-xl overflow-hidden"
            >
              {/* Original Benefit */}
              <div className="bg-gold-50 px-4 py-3 border-b border-gold-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gold-500 text-navy-800 text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gold-800">Original:</span>
                  <span className="text-sm text-gold-700">{benefit || '(empty)'}</span>
                </div>
              </div>

              {/* Expanded Version */}
              <div className="p-4">
                <label className="block text-sm font-medium text-navy-700 mb-2">
                  Expanded Version
                </label>
                <textarea
                  value={expanded.benefitExpansions[index]}
                  onChange={(e) => handleBenefitExpansionChange(index, e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-cream-300 rounded-lg
                           text-navy-800 placeholder-navy-300
                           transition-all duration-200
                           focus:border-gold-500 focus:ring-2 focus:ring-gold-200
                           resize-none"
                  placeholder="Expanded benefit statement..."
                />
                <p className="mt-2 text-xs text-navy-400">
                  {expanded.benefitExpansions[index].length} characters • Aim for 150-250 characters
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn btn-secondary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Input
        </button>
        <button type="button" onClick={onSubmit} className="btn btn-primary">
          Continue to Review
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
