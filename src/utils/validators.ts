import type { ClientInfo, ProjectInfo, ProblemsAndBenefits } from '../types/proposal';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateClientInfo(client: ClientInfo): ValidationResult {
  const errors: Record<string, string> = {};

  if (!client.firstName.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!client.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }

  if (!client.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(client.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!client.company.trim()) {
    errors.company = 'Company name is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateProjectInfo(project: ProjectInfo): ValidationResult {
  const errors: Record<string, string> = {};

  if (!project.title.trim()) {
    errors.title = 'Project title is required';
  }

  if (!project.duration.trim()) {
    errors.duration = 'Project duration is required';
  }

  if (!project.monthOneInvestment.trim()) {
    errors.monthOneInvestment = 'Month 1 investment is required';
  }

  if (!project.monthTwoInvestment.trim()) {
    errors.monthTwoInvestment = 'Month 2 investment is required';
  }

  if (!project.monthThreeInvestment.trim()) {
    errors.monthThreeInvestment = 'Month 3+ investment is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateProblemsAndBenefits(content: ProblemsAndBenefits): ValidationResult {
  const errors: Record<string, string> = {};

  content.problems.forEach((problem, index) => {
    if (!problem.trim()) {
      errors[`problem${index + 1}`] = `Problem ${index + 1} is required`;
    }
  });

  content.benefits.forEach((benefit, index) => {
    if (!benefit.trim()) {
      errors[`benefit${index + 1}`] = `Benefit ${index + 1} is required`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAllInput(
  client: ClientInfo,
  project: ProjectInfo,
  content: ProblemsAndBenefits
): ValidationResult {
  const clientValidation = validateClientInfo(client);
  const projectValidation = validateProjectInfo(project);
  const contentValidation = validateProblemsAndBenefits(content);

  const allErrors = {
    ...clientValidation.errors,
    ...projectValidation.errors,
    ...contentValidation.errors,
  };

  return {
    isValid: Object.keys(allErrors).length === 0,
    errors: allErrors,
  };
}
