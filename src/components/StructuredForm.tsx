import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientInfo, ProjectInfo, ProblemsAndBenefits } from '../types/proposal';
import { validateAllInput } from '../utils/validators';

interface StructuredFormProps {
  client: ClientInfo;
  project: ProjectInfo;
  content: ProblemsAndBenefits;
  onClientChange: (updates: Partial<ClientInfo>) => void;
  onProjectChange: (updates: Partial<ProjectInfo>) => void;
  onContentChange: (updates: Partial<ProblemsAndBenefits>) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function StructuredForm({
  client,
  project,
  content,
  onClientChange,
  onProjectChange,
  onContentChange,
  onSubmit,
  onBack,
}: StructuredFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<'client' | 'project' | 'content'>('client');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAllInput(client, project, content);

    if (!validation.isValid) {
      setErrors(validation.errors);
      // Focus first error section
      if (Object.keys(validation.errors).some((k) => ['firstName', 'lastName', 'email', 'company'].includes(k))) {
        setActiveSection('client');
      } else if (Object.keys(validation.errors).some((k) => k.startsWith('month') || k === 'title' || k === 'duration')) {
        setActiveSection('project');
      } else {
        setActiveSection('content');
      }
      return;
    }

    setErrors({});
    onSubmit();
  };

  const handleProblemChange = (index: number, value: string) => {
    const newProblems = [...content.problems] as [string, string, string, string];
    newProblems[index] = value;
    onContentChange({ problems: newProblems });
  };

  const handleBenefitChange = (index: number, value: string) => {
    const newBenefits = [...content.benefits] as [string, string, string, string];
    newBenefits[index] = value;
    onContentChange({ benefits: newBenefits });
  };

  const sections = [
    { id: 'client' as const, label: 'Client Details', icon: '👤' },
    { id: 'project' as const, label: 'Project Info', icon: '📋' },
    { id: 'content' as const, label: 'Problems & Benefits', icon: '💡' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section Tabs */}
      <div className="flex gap-2 p-1 bg-cream-200 rounded-xl">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`
              flex-1 py-3 px-4 rounded-lg text-sm font-medium
              transition-all duration-200
              ${
                activeSection === section.id
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-navy-500 hover:text-navy-700'
              }
            `}
          >
            <span className="mr-2">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Client Details Section */}
      {activeSection === 'client' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl p-8 shadow-card"
        >
          <h3 className="font-display text-xl font-semibold text-navy-800 mb-6 gold-accent inline-block">
            Client Information
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-field">
              <label>First Name</label>
              <input
                type="text"
                value={client.firstName}
                onChange={(e) => onClientChange({ firstName: e.target.value })}
                placeholder="John"
                className={errors.firstName ? 'error' : ''}
              />
              {errors.firstName && <p className="error-message">{errors.firstName}</p>}
            </div>

            <div className="form-field">
              <label>Last Name</label>
              <input
                type="text"
                value={client.lastName}
                onChange={(e) => onClientChange({ lastName: e.target.value })}
                placeholder="Smith"
                className={errors.lastName ? 'error' : ''}
              />
              {errors.lastName && <p className="error-message">{errors.lastName}</p>}
            </div>

            <div className="form-field">
              <label>Email Address</label>
              <input
                type="email"
                value={client.email}
                onChange={(e) => onClientChange({ email: e.target.value })}
                placeholder="john@company.com"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <p className="error-message">{errors.email}</p>}
            </div>

            <div className="form-field">
              <label>Company Name</label>
              <input
                type="text"
                value={client.company}
                onChange={(e) => onClientChange({ company: e.target.value })}
                placeholder="Acme Corp"
                className={errors.company ? 'error' : ''}
              />
              {errors.company && <p className="error-message">{errors.company}</p>}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveSection('project')}
              className="btn btn-primary"
            >
              Continue to Project Info
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Project Info Section */}
      {activeSection === 'project' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl p-8 shadow-card"
        >
          <h3 className="font-display text-xl font-semibold text-navy-800 mb-6 gold-accent inline-block">
            Project Details
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-field md:col-span-2">
              <label>Project Title</label>
              <input
                type="text"
                value={project.title}
                onChange={(e) => onProjectChange({ title: e.target.value })}
                placeholder="Revenue Operations Transformation"
                className={errors.title ? 'error' : ''}
              />
              {errors.title && <p className="error-message">{errors.title}</p>}
            </div>

            <div className="form-field">
              <label>Project Duration</label>
              <input
                type="text"
                value={project.duration}
                onChange={(e) => onProjectChange({ duration: e.target.value })}
                placeholder="3 months"
                className={errors.duration ? 'error' : ''}
              />
              {errors.duration && <p className="error-message">{errors.duration}</p>}
            </div>

            <div className="form-field">
              <label>Total Project Value</label>
              <input
                type="text"
                value={project.totalValue}
                onChange={(e) => onProjectChange({ totalValue: e.target.value })}
                placeholder="$25,000"
              />
            </div>

            <div className="form-field">
              <label>Platform Costs (if any)</label>
              <input
                type="text"
                value={project.platformCosts}
                onChange={(e) => onProjectChange({ platformCosts: e.target.value })}
                placeholder="$500/month"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-cream-300">
            <h4 className="font-medium text-navy-700 mb-4">Investment Breakdown</h4>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="form-field">
                <label>Month 1</label>
                <input
                  type="text"
                  value={project.monthOneInvestment}
                  onChange={(e) => onProjectChange({ monthOneInvestment: e.target.value })}
                  placeholder="$10,000"
                  className={errors.monthOneInvestment ? 'error' : ''}
                />
                {errors.monthOneInvestment && <p className="error-message">{errors.monthOneInvestment}</p>}
              </div>

              <div className="form-field">
                <label>Month 2</label>
                <input
                  type="text"
                  value={project.monthTwoInvestment}
                  onChange={(e) => onProjectChange({ monthTwoInvestment: e.target.value })}
                  placeholder="$8,000"
                  className={errors.monthTwoInvestment ? 'error' : ''}
                />
                {errors.monthTwoInvestment && <p className="error-message">{errors.monthTwoInvestment}</p>}
              </div>

              <div className="form-field">
                <label>Month 3+</label>
                <input
                  type="text"
                  value={project.monthThreeInvestment}
                  onChange={(e) => onProjectChange({ monthThreeInvestment: e.target.value })}
                  placeholder="$2,500/month"
                  className={errors.monthThreeInvestment ? 'error' : ''}
                />
                {errors.monthThreeInvestment && <p className="error-message">{errors.monthThreeInvestment}</p>}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveSection('client')}
              className="btn btn-secondary"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('content')}
              className="btn btn-primary"
            >
              Continue to Problems & Benefits
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Problems & Benefits Section */}
      {activeSection === 'content' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Problems */}
          <div className="bg-white rounded-2xl p-8 shadow-card">
            <h3 className="font-display text-xl font-semibold text-navy-800 mb-2 gold-accent inline-block">
              Key Problems
            </h3>
            <p className="text-navy-500 mb-6">
              List 4 key problems the client is facing. Keep them brief - we'll expand them later.
            </p>

            <div className="space-y-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="form-field">
                  <label>Problem {index + 1}</label>
                  <input
                    type="text"
                    value={content.problems[index]}
                    onChange={(e) => handleProblemChange(index, e.target.value)}
                    placeholder={`e.g., "Poor lead conversion rates", "Manual data entry", etc.`}
                    className={errors[`problem${index + 1}`] ? 'error' : ''}
                  />
                  {errors[`problem${index + 1}`] && (
                    <p className="error-message">{errors[`problem${index + 1}`]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-2xl p-8 shadow-card">
            <h3 className="font-display text-xl font-semibold text-navy-800 mb-2 gold-accent inline-block">
              Key Benefits
            </h3>
            <p className="text-navy-500 mb-6">
              List 4 key benefits your solution will provide. Keep them brief - we'll expand them later.
            </p>

            <div className="space-y-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="form-field">
                  <label>Benefit {index + 1}</label>
                  <input
                    type="text"
                    value={content.benefits[index]}
                    onChange={(e) => handleBenefitChange(index, e.target.value)}
                    placeholder={`e.g., "Automated lead scoring", "Real-time analytics", etc.`}
                    className={errors[`benefit${index + 1}`] ? 'error' : ''}
                  />
                  {errors[`benefit${index + 1}`] && (
                    <p className="error-message">{errors[`benefit${index + 1}`]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <button type="button" onClick={() => setActiveSection('project')} className="btn btn-secondary">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button type="submit" className="btn btn-gold">
              Generate Expanded Content
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Back to mode selection */}
      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-navy-500 hover:text-navy-700 underline underline-offset-4"
        >
          Choose a different input method
        </button>
      </div>
    </form>
  );
}
