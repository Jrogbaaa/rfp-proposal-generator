import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ProposalData } from '../types/proposal';

interface ProposalReviewProps {
  data: ProposalData;
  isLoading: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

export default function ProposalReview({
  data,
  isLoading,
  error,
  onSubmit,
  onBack,
}: ProposalReviewProps) {
  const [showJson, setShowJson] = useState(false);

  const jsonPayload = {
    client: {
      firstName: data.client.firstName,
      lastName: data.client.lastName,
      email: data.client.email,
      company: data.client.company,
    },
    project: {
      title: data.project.title,
      problems: {
        problem01: data.expanded.problemExpansions[0],
        problem02: data.expanded.problemExpansions[1],
        problem03: data.expanded.problemExpansions[2],
        problem04: data.expanded.problemExpansions[3],
      },
      benefits: {
        benefit01: data.expanded.benefitExpansions[0],
        benefit02: data.expanded.benefitExpansions[1],
        benefit03: data.expanded.benefitExpansions[2],
        benefit04: data.expanded.benefitExpansions[3],
      },
      monthOneInvestment: data.project.monthOneInvestment,
      monthTwoInvestment: data.project.monthTwoInvestment,
      monthThreeInvestment: data.project.monthThreeInvestment,
    },
    generated: {
      slideFooter: data.generated.slideFooter,
      contractFooterSlug: data.generated.contractFooterSlug,
      createdDate: data.generated.createdDate,
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-2xl font-semibold text-navy-800 gold-accent inline-block">
          Review Your Proposal
        </h2>
        <p className="mt-4 text-navy-600">
          Review all the details before creating your proposal.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-red-800">Error creating proposal</h4>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Proposal Preview */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Client & Project */}
        <div className="space-y-6">
          {/* Client Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-navy-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-navy-800">Client</h3>
            </div>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-navy-500">Name</dt>
                <dd className="font-medium text-navy-800">{data.client.firstName} {data.client.lastName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-500">Email</dt>
                <dd className="font-medium text-navy-800">{data.client.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-500">Company</dt>
                <dd className="font-medium text-navy-800">{data.client.company}</dd>
              </div>
            </dl>
          </div>

          {/* Project Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-navy-800">Project</h3>
            </div>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-navy-500">Title</dt>
                <dd className="font-medium text-navy-800">{data.project.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-500">Duration</dt>
                <dd className="font-medium text-navy-800">{data.project.duration}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-500">Total Value</dt>
                <dd className="font-medium text-gold-600">{data.project.totalValue}</dd>
              </div>
            </dl>
          </div>

          {/* Investment Breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy-800 mb-4">Investment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-cream-100 rounded-lg">
                <span className="text-navy-600">Month 1</span>
                <span className="font-semibold text-navy-800">{data.project.monthOneInvestment}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-cream-100 rounded-lg">
                <span className="text-navy-600">Month 2</span>
                <span className="font-semibold text-navy-800">{data.project.monthTwoInvestment}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-cream-100 rounded-lg">
                <span className="text-navy-600">Month 3+</span>
                <span className="font-semibold text-navy-800">{data.project.monthThreeInvestment}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Content Preview */}
        <div className="space-y-6">
          {/* Problems Preview */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy-800 mb-4">Problems</h3>
            <div className="space-y-4">
              {data.expanded.problemExpansions.map((problem, index) => (
                <div key={index} className="border-l-3 border-navy-300 pl-4">
                  <p className="text-sm text-navy-600 leading-relaxed">{problem}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits Preview */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-navy-800 mb-4">Benefits</h3>
            <div className="space-y-4">
              {data.expanded.benefitExpansions.map((benefit, index) => (
                <div key={index} className="border-l-3 border-gold-400 pl-4">
                  <p className="text-sm text-navy-600 leading-relaxed">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Generated Metadata */}
          <div className="bg-cream-100 rounded-xl p-4">
            <h4 className="text-sm font-medium text-navy-700 mb-2">Generated Metadata</h4>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-navy-500">Slide Footer</dt>
                <dd className="font-mono text-navy-700">{data.generated.slideFooter}</dd>
              </div>
              <div>
                <dt className="text-navy-500">Contract Slug</dt>
                <dd className="font-mono text-navy-700">{data.generated.contractFooterSlug}</dd>
              </div>
              <div>
                <dt className="text-navy-500">Created Date</dt>
                <dd className="font-mono text-navy-700">{data.generated.createdDate}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* JSON Payload (Collapsible) */}
      <div className="bg-navy-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="font-medium text-white">JSON Payload</span>
            <span className="text-xs text-navy-400">(for debugging)</span>
          </div>
          <motion.svg
            animate={{ rotate: showJson ? 180 : 0 }}
            className="w-5 h-5 text-navy-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>

        {showJson && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-navy-700"
          >
            <pre className="p-6 text-sm text-cream-300 overflow-x-auto max-h-96">
              {JSON.stringify(jsonPayload, null, 2)}
            </pre>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} disabled={isLoading} className="btn btn-secondary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Content
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="btn btn-gold min-w-[200px]"
        >
          {isLoading ? (
            <>
              <span className="spinner mr-2" />
              Creating Proposal...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Create Proposal
            </>
          )}
        </button>
      </div>
    </div>
  );
}
