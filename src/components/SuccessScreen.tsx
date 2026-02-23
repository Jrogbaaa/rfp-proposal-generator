import { motion } from 'framer-motion';

interface SuccessScreenProps {
  pandadocLink: string;
  clientName: string;
  companyName: string;
  onCreateAnother: () => void;
}

export default function SuccessScreen({
  pandadocLink,
  clientName,
  companyName,
  onCreateAnother,
}: SuccessScreenProps) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-8">
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 mx-auto bg-gold-100 rounded-full flex items-center justify-center"
      >
        <motion.svg
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-12 h-12 text-gold-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      </motion.div>

      {/* Success Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="font-display text-3xl font-semibold text-navy-800">
          Proposal Created!
        </h2>
        <p className="mt-4 text-lg text-navy-600">
          Your proposal for <span className="font-semibold">{clientName}</span> at{' '}
          <span className="font-semibold">{companyName}</span> has been created in PandaDoc.
        </p>
      </motion.div>

      {/* PandaDoc Link Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl p-8 shadow-card"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <svg className="w-8 h-8 text-navy-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/>
          </svg>
          <h3 className="font-display text-xl font-semibold text-navy-800">
            Open in PandaDoc
          </h3>
        </div>

        <p className="text-navy-500 mb-6">
          Click the button below to open your proposal in PandaDoc for editing and sending.
        </p>

        <a
          href={pandadocLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary w-full justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Proposal in PandaDoc
        </a>

        {/* Link display */}
        <div className="mt-4 p-3 bg-cream-100 rounded-lg">
          <p className="text-xs text-navy-500 mb-1">Direct link:</p>
          <code className="text-sm text-navy-700 break-all">{pandadocLink}</code>
        </div>
      </motion.div>

      {/* Next Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gold-50 border border-gold-200 rounded-xl p-6 text-left"
      >
        <h4 className="font-medium text-gold-800 mb-3">Next Steps</h4>
        <ol className="space-y-2 text-sm text-gold-700">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gold-200 text-gold-800 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
            <span>Review and customize the proposal content in PandaDoc</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gold-200 text-gold-800 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
            <span>Add any additional sections, images, or branding</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gold-200 text-gold-800 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
            <span>Send the proposal to {clientName} for review and signature</span>
          </li>
        </ol>
      </motion.div>

      {/* Create Another */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <button
          type="button"
          onClick={onCreateAnother}
          className="btn btn-secondary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Another Proposal
        </button>
      </motion.div>
    </div>
  );
}
