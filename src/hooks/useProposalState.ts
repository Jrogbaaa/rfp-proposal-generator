import { useState, useCallback } from 'react';
import type {
  ProposalState,
  ClientInfo,
  ProjectInfo,
  ProblemsAndBenefits,
  ExpandedContent,
  Step,
} from '../types/proposal';
import {
  expandProblems,
  expandBenefits,
  generateSlideFooter,
  generateContractSlug,
  generateCreatedDate,
} from '../utils/contentExpander';
import { createProposal } from '../utils/pandadoc';

const INITIAL_STATE: ProposalState = {
  step: 0,
  inputMode: null,
  client: {
    firstName: '',
    lastName: '',
    email: '',
    company: '',
  },
  project: {
    title: '',
    duration: '',
    totalValue: '',
    platformCosts: '',
    monthOneInvestment: '',
    monthTwoInvestment: '',
    monthThreeInvestment: '',
  },
  content: {
    problems: ['', '', '', ''],
    benefits: ['', '', '', ''],
  },
  expanded: {
    problemExpansions: ['', '', '', ''],
    benefitExpansions: ['', '', '', ''],
  },
  generated: {
    slideFooter: '',
    contractFooterSlug: '',
    createdDate: '',
  },
  pandadocLink: null,
  isLoading: false,
  error: null,
};

export function useProposalState() {
  const [state, setState] = useState<ProposalState>(INITIAL_STATE);

  const setInputMode = useCallback((mode: 'structured' | 'transcript') => {
    setState((prev) => ({ ...prev, inputMode: mode }));
  }, []);

  const updateClient = useCallback((updates: Partial<ClientInfo>) => {
    setState((prev) => ({
      ...prev,
      client: { ...prev.client, ...updates },
    }));
  }, []);

  const updateProject = useCallback((updates: Partial<ProjectInfo>) => {
    setState((prev) => ({
      ...prev,
      project: { ...prev.project, ...updates },
    }));
  }, []);

  const updateContent = useCallback((updates: Partial<ProblemsAndBenefits>) => {
    setState((prev) => ({
      ...prev,
      content: { ...prev.content, ...updates },
    }));
  }, []);

  const updateExpanded = useCallback((updates: Partial<ExpandedContent>) => {
    setState((prev) => ({
      ...prev,
      expanded: { ...prev.expanded, ...updates },
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: prev.step + 1, error: null }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(0, prev.step - 1), error: null }));
  }, []);

  const generateExpandedContent = useCallback(() => {
    setState((prev) => {
      const expandedProblems = expandProblems(prev.content.problems);
      const expandedBenefits = expandBenefits(prev.content.benefits);
      const slideFooter = generateSlideFooter(prev.client.company);
      const contractSlug = generateContractSlug(prev.client.company, prev.project.title);
      const createdDate = generateCreatedDate();

      return {
        ...prev,
        expanded: {
          problemExpansions: expandedProblems,
          benefitExpansions: expandedBenefits,
        },
        generated: {
          slideFooter,
          contractFooterSlug: contractSlug,
          createdDate,
        },
        step: prev.step + 1,
      };
    });
  }, []);

  const submitProposal = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await createProposal({
        client: state.client,
        project: state.project,
        content: state.content,
        expanded: state.expanded,
        generated: state.generated,
      });

      setState((prev) => ({
        ...prev,
        isLoading: false,
        pandadocLink: result.internalLink,
        step: prev.step + 1,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create proposal',
      }));
    }
  }, [state.client, state.project, state.content, state.expanded, state.generated]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const getCurrentStep = (): Step => {
    switch (state.step) {
      case 0:
        return 'input';
      case 1:
        return 'expand';
      case 2:
        return 'review';
      case 3:
        return 'success';
      default:
        return 'input';
    }
  };

  return {
    state,
    currentStep: getCurrentStep(),
    setInputMode,
    updateClient,
    updateProject,
    updateContent,
    updateExpanded,
    goToStep,
    nextStep,
    prevStep,
    generateExpandedContent,
    submitProposal,
    reset,
    setError,
  };
}
