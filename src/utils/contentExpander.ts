// Template-based content expansion for problems and benefits
// Uses revenue-focused, direct "you" language as specified in the workflow

const PROBLEM_TEMPLATES = [
  (problem: string) =>
    `Right now, ${problem.toLowerCase()}. This isn't just an operational inconvenience—it's directly impacting your bottom line. Every day this continues, you're leaving money on the table that could be reinvested into growth.`,

  (problem: string) =>
    `Your team is struggling with ${problem.toLowerCase()}. The hidden cost here isn't just time—it's the compounding effect on revenue. When this process breaks down, deals slip through the cracks and your conversion rates suffer.`,

  (problem: string) =>
    `${problem.charAt(0).toUpperCase() + problem.slice(1).toLowerCase()} is creating friction at a critical point in your customer journey. The financial impact is significant: even a small improvement here would translate to tens of thousands in additional revenue.`,

  (problem: string) =>
    `You're dealing with ${problem.toLowerCase()}, and it's costing you more than you might realize. Beyond the obvious operational drag, this creates downstream effects that multiply across your entire revenue engine.`,
];

const BENEFIT_TEMPLATES = [
  (benefit: string) =>
    `With ${benefit.toLowerCase()}, you'll see immediate ROI. We're talking about a system that pays for itself within the first month and continues delivering measurable value every quarter after that.`,

  (benefit: string) =>
    `${benefit.charAt(0).toUpperCase() + benefit.slice(1).toLowerCase()} will transform how your team operates. The implementation is straightforward, and you'll have full visibility into the metrics that matter—revenue impact, time saved, and conversion improvements.`,

  (benefit: string) =>
    `You'll gain ${benefit.toLowerCase()}, giving you the leverage to scale without proportionally increasing costs. This is about building infrastructure that compounds in value over time.`,

  (benefit: string) =>
    `By implementing ${benefit.toLowerCase()}, you're not just solving today's problem—you're future-proofing your operations. The payback period is measured in weeks, not months.`,
];

export function expandProblems(problems: [string, string, string, string]): [string, string, string, string] {
  return problems.map((problem, index) =>
    PROBLEM_TEMPLATES[index % PROBLEM_TEMPLATES.length](problem)
  ) as [string, string, string, string];
}

export function expandBenefits(benefits: [string, string, string, string]): [string, string, string, string] {
  return benefits.map((benefit, index) =>
    BENEFIT_TEMPLATES[index % BENEFIT_TEMPLATES.length](benefit)
  ) as [string, string, string, string];
}

export function generateSlideFooter(company: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  return `Confidential | ${company} Strategic Initiative | ${date}`;
}

export function generateContractSlug(company: string, projectTitle: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const cleanCompany = company.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const cleanTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  return `${cleanCompany}-${cleanTitle}-${year}-${month}`;
}

export function generateCreatedDate(): string {
  return new Date().toISOString().split('T')[0];
}
