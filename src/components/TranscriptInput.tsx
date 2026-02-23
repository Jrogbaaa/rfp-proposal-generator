import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientInfo, ProjectInfo, ProblemsAndBenefits } from '../types/proposal';

interface TranscriptInputProps {
  client: ClientInfo;
  project: ProjectInfo;
  content: ProblemsAndBenefits;
  onClientChange: (updates: Partial<ClientInfo>) => void;
  onProjectChange: (updates: Partial<ProjectInfo>) => void;
  onContentChange: (updates: Partial<ProblemsAndBenefits>) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function TranscriptInput({
  client,
  project,
  content,
  onClientChange,
  onProjectChange,
  onContentChange,
  onSubmit,
  onBack,
}: TranscriptInputProps) {
  const [transcript, setTranscript] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const handleExtract = () => {
    setIsExtracting(true);

    // Simulate extraction delay for UX
    setTimeout(() => {
      // Basic extraction logic - in production this could use AI

      // Try to extract email
      const emailMatch = transcript.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        onClientChange({ email: emailMatch[0] });

        // Try to extract domain for company name
        const domain = emailMatch[0].split('@')[1].split('.')[0];
        if (domain && !['gmail', 'yahoo', 'hotmail', 'outlook'].includes(domain)) {
          onClientChange({ company: domain.charAt(0).toUpperCase() + domain.slice(1) });
        }
      }

      // Look for name patterns
      const namePatterns = [
        /(?:speaking with|talking to|meeting with|call with)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
        /(?:hi|hello|hey)\s+([A-Z][a-z]+)/i,
        /([A-Z][a-z]+)\s+(?:from|at|with)\s+/i,
      ];

      for (const pattern of namePatterns) {
        const match = transcript.match(pattern);
        if (match) {
          if (match[1]) onClientChange({ firstName: match[1] });
          if (match[2]) onClientChange({ lastName: match[2] });
          break;
        }
      }

      // Extract problems (look for pain points, challenges, issues)
      const problemKeywords = ['problem', 'challenge', 'struggle', 'issue', 'pain', 'difficult', 'hard to', 'can\'t'];
      const sentences = transcript.split(/[.!?]+/);
      const potentialProblems: string[] = [];

      sentences.forEach((sentence) => {
        if (problemKeywords.some((kw) => sentence.toLowerCase().includes(kw))) {
          const cleaned = sentence.trim();
          if (cleaned.length > 10 && cleaned.length < 200) {
            potentialProblems.push(cleaned);
          }
        }
      });

      if (potentialProblems.length > 0) {
        const problems = potentialProblems.slice(0, 4);
        while (problems.length < 4) problems.push('');
        onContentChange({ problems: problems as [string, string, string, string] });
      }

      // Extract benefits (look for solutions, goals, improvements)
      const benefitKeywords = ['want to', 'need to', 'goal', 'improve', 'increase', 'reduce', 'automate', 'streamline'];
      const potentialBenefits: string[] = [];

      sentences.forEach((sentence) => {
        if (benefitKeywords.some((kw) => sentence.toLowerCase().includes(kw))) {
          const cleaned = sentence.trim();
          if (cleaned.length > 10 && cleaned.length < 200) {
            potentialBenefits.push(cleaned);
          }
        }
      });

      if (potentialBenefits.length > 0) {
        const benefits = potentialBenefits.slice(0, 4);
        while (benefits.length < 4) benefits.push('');
        onContentChange({ benefits: benefits as [string, string, string, string] });
      }

      // Look for monetary values
      const moneyMatch = transcript.match(/\$[\d,]+/g);
      if (moneyMatch && moneyMatch.length > 0) {
        onProjectChange({ totalValue: moneyMatch[0] });
      }

      setIsExtracting(false);
      setExtracted(true);
    }, 1500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-2xl font-semibold text-navy-800 gold-accent inline-block">
          Paste Your Call Transcript
        </h2>
        <p className="mt-4 text-navy-600">
          Paste your sales call notes or transcript below. We'll extract the key information
          and let you review before generating the proposal.
        </p>
      </div>

      {/* Transcript Input */}
      <div className="bg-white rounded-2xl p-8 shadow-card">
        <div className="form-field">
          <label className="flex items-center justify-between">
            <span>Call Transcript / Notes</span>
            <span className="text-sm text-navy-400">{transcript.length} characters</span>
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Paste your call transcript or notes here...

Example:
"Had a great call with John Smith from Acme Corp (john@acmecorp.com). They're struggling with manual lead scoring and their conversion rates have dropped 15% this quarter.

Main challenges:
- No automated lead qualification
- Sales team spending too much time on unqualified leads
- Reporting is manual and takes 2 days per week
- CRM data is messy and unreliable

They want to implement automated lead scoring, clean up their CRM, and build real-time dashboards. Budget is around $25,000 for a 3-month engagement."`}
            rows={12}
            className="font-mono text-sm"
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-navy-500">
            Tip: Include client name, email, problems, and goals for best extraction results.
          </p>
          <button
            type="button"
            onClick={handleExtract}
            disabled={transcript.length < 50 || isExtracting}
            className="btn btn-primary"
          >
            {isExtracting ? (
              <>
                <span className="spinner mr-2" />
                Extracting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Extract Information
              </>
            )}
          </button>
        </div>
      </div>

      {/* Extracted Data Preview */}
      {extracted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 text-gold-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Information extracted! Review and edit below:</span>
          </div>

          {/* Client Info */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h4 className="font-medium text-navy-800 mb-4">Client Information</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-field">
                <label>First Name</label>
                <input
                  type="text"
                  value={client.firstName}
                  onChange={(e) => onClientChange({ firstName: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div className="form-field">
                <label>Last Name</label>
                <input
                  type="text"
                  value={client.lastName}
                  onChange={(e) => onClientChange({ lastName: e.target.value })}
                  placeholder="Last name"
                />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => onClientChange({ email: e.target.value })}
                  placeholder="email@company.com"
                />
              </div>
              <div className="form-field">
                <label>Company</label>
                <input
                  type="text"
                  value={client.company}
                  onChange={(e) => onClientChange({ company: e.target.value })}
                  placeholder="Company name"
                />
              </div>
            </div>
          </div>

          {/* Project Info */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h4 className="font-medium text-navy-800 mb-4">Project Information</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-field md:col-span-2">
                <label>Project Title</label>
                <input
                  type="text"
                  value={project.title}
                  onChange={(e) => onProjectChange({ title: e.target.value })}
                  placeholder="e.g., Revenue Operations Transformation"
                />
              </div>
              <div className="form-field">
                <label>Duration</label>
                <input
                  type="text"
                  value={project.duration}
                  onChange={(e) => onProjectChange({ duration: e.target.value })}
                  placeholder="e.g., 3 months"
                />
              </div>
              <div className="form-field">
                <label>Total Value</label>
                <input
                  type="text"
                  value={project.totalValue}
                  onChange={(e) => onProjectChange({ totalValue: e.target.value })}
                  placeholder="e.g., $25,000"
                />
              </div>
              <div className="form-field">
                <label>Month 1 Investment</label>
                <input
                  type="text"
                  value={project.monthOneInvestment}
                  onChange={(e) => onProjectChange({ monthOneInvestment: e.target.value })}
                  placeholder="e.g., $10,000"
                />
              </div>
              <div className="form-field">
                <label>Month 2 Investment</label>
                <input
                  type="text"
                  value={project.monthTwoInvestment}
                  onChange={(e) => onProjectChange({ monthTwoInvestment: e.target.value })}
                  placeholder="e.g., $8,000"
                />
              </div>
              <div className="form-field">
                <label>Month 3+ Investment</label>
                <input
                  type="text"
                  value={project.monthThreeInvestment}
                  onChange={(e) => onProjectChange({ monthThreeInvestment: e.target.value })}
                  placeholder="e.g., $2,500/month"
                />
              </div>
            </div>
          </div>

          {/* Problems */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h4 className="font-medium text-navy-800 mb-4">Extracted Problems</h4>
            <div className="space-y-3">
              {content.problems.map((problem, index) => (
                <div key={index} className="form-field">
                  <label>Problem {index + 1}</label>
                  <input
                    type="text"
                    value={problem}
                    onChange={(e) => {
                      const newProblems = [...content.problems] as [string, string, string, string];
                      newProblems[index] = e.target.value;
                      onContentChange({ problems: newProblems });
                    }}
                    placeholder={`Problem ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <h4 className="font-medium text-navy-800 mb-4">Extracted Benefits/Goals</h4>
            <div className="space-y-3">
              {content.benefits.map((benefit, index) => (
                <div key={index} className="form-field">
                  <label>Benefit {index + 1}</label>
                  <input
                    type="text"
                    value={benefit}
                    onChange={(e) => {
                      const newBenefits = [...content.benefits] as [string, string, string, string];
                      newBenefits[index] = e.target.value;
                      onContentChange({ benefits: newBenefits });
                    }}
                    placeholder={`Benefit ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button type="button" onClick={onBack} className="btn btn-secondary">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button type="button" onClick={onSubmit} className="btn btn-gold">
              Generate Expanded Content
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Back link */}
      {!extracted && (
        <div className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-navy-500 hover:text-navy-700 underline underline-offset-4"
          >
            Choose a different input method
          </button>
        </div>
      )}
    </div>
  );
}
