import { useMemo } from 'react'
import type { ProposalData, ClientInfo, ProjectInfo, ProblemsAndBenefits } from '../types/proposal'

/**
 * Parses free-form brief text into structured ProposalData
 * Handles various formats: key:value pairs, markdown lists, prose
 */
export function useBriefParser(text: string): Partial<ProposalData> | null {
  return useMemo(() => {
    if (!text.trim()) return null

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    const client: Partial<ClientInfo> = {}
    const project: Partial<ProjectInfo> = {}
    const problems: string[] = []
    const benefits: string[] = []

    let currentSection: 'problems' | 'benefits' | 'scope' | null = null

    for (const line of lines) {
      const lowerLine = line.toLowerCase()

      // Detect section headers
      if (lowerLine.startsWith('problems:') || lowerLine.startsWith('challenges:') || lowerLine.startsWith('issues:')) {
        currentSection = 'problems'
        continue
      }
      if (lowerLine.startsWith('benefits:') || lowerLine.startsWith('outcomes:') || lowerLine.startsWith('solutions:') || lowerLine.startsWith('results:')) {
        currentSection = 'benefits'
        continue
      }
      if (lowerLine.startsWith('scope:') || lowerLine.startsWith('deliverables:')) {
        currentSection = 'scope'
        continue
      }

      // Handle list items in current section
      if (currentSection && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))) {
        const item = line.replace(/^[-•\d.]+\s*/, '').trim()
        if (item) {
          if (currentSection === 'problems') {
            problems.push(item)
          } else if (currentSection === 'benefits') {
            benefits.push(item)
          }
        }
        continue
      }

      // Reset section if we hit a new header
      if (line.endsWith(':') && !line.includes(' - ')) {
        currentSection = null
      }

      // Parse key-value pairs
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0 && colonIndex < 30) {
        const key = line.slice(0, colonIndex).toLowerCase().trim()
        const value = line.slice(colonIndex + 1).trim()

        if (!value) continue

        // Project title
        if (key === 'project' || key === 'title' || key === 'project name') {
          project.title = value
        }
        // Client info
        else if (key === 'client' || key === 'contact') {
          // Try to parse "Name, email, company" format
          const parts = value.split(',').map(p => p.trim())
          if (parts.length >= 1) {
            const nameParts = parts[0].split(' ')
            client.firstName = nameParts[0] || ''
            client.lastName = nameParts.slice(1).join(' ') || ''
          }
          if (parts.length >= 2 && parts[1].includes('@')) {
            client.email = parts[1]
          }
          // Company = the last non-name, non-email part. Handles both
          // "Name, email, Company" and "Name, Company" (no email) shapes.
          const companyPart = parts.slice(1).find(p => p && !p.includes('@'))
          if (parts.length >= 2 && companyPart) {
            client.company = companyPart
          }
        }
        else if (key === 'company' || key === 'organization') {
          client.company = value
        }
        else if (key === 'email') {
          client.email = value
        }
        else if (key === 'name' || key === 'contact name') {
          const nameParts = value.split(' ')
          client.firstName = nameParts[0] || ''
          client.lastName = nameParts.slice(1).join(' ') || ''
        }
        // Project details
        else if (key === 'timeline' || key === 'duration' || key === 'timeframe') {
          project.duration = value
        }
        else if (key === 'budget' || key === 'investment' || key === 'price' || key === 'cost' || key === 'total' || key === 'total value') {
          project.totalValue = value
        }
        // Platform costs
        else if (key === 'platform costs' || key === 'platform' || key === 'software costs' || key === 'tool costs') {
          project.platformCosts = value
        }
        // Month-by-month investments
        else if (key === 'month 1' || key === 'month 1 investment' || key === 'month one' || key === 'month one investment' || key === 'first month') {
          project.monthOneInvestment = value
        }
        else if (key === 'month 2' || key === 'month 2 investment' || key === 'month two' || key === 'month two investment' || key === 'second month') {
          project.monthTwoInvestment = value
        }
        else if (key === 'month 3' || key === 'month 3 investment' || key === 'month three' || key === 'month three investment' || key === 'third month' || key === 'month 3+' || key === 'ongoing') {
          project.monthThreeInvestment = value
        }
      }
    }

    // Free-form fallback: no structured Company/Client line was found, so try
    // to lift a brand from a "for <Proper Noun>" phrase (e.g. "...deck for
    // Dunkin'..."). Best-effort only — skips stop-words/dates and leaves the
    // company empty (greeting falls back to "your client") when unsure.
    if (!client.company) {
      const m = text.match(/\bfor\s+([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,2})/)
      if (m) {
        const candidate = m[1].trim().replace(/[.,;:]+$/, '')
        const firstWord = candidate.split(/\s+/)[0]
        const STOP = /^(the|a|an|q[1-4]|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)$/i
        if (!STOP.test(firstWord) && !/^\d/.test(candidate)) {
          client.company = candidate
        }
      }
    }

    // Pad arrays to 4 items as required by type
    const padArray = (arr: string[], length: number): [string, string, string, string] => {
      const result = [...arr]
      while (result.length < length) result.push('')
      return result.slice(0, 4) as [string, string, string, string]
    }

    const content: ProblemsAndBenefits = {
      problems: padArray(problems, 4),
      benefits: padArray(benefits, 4),
    }

    return {
      client: client as ClientInfo,
      project: project as ProjectInfo,
      content,
    }
  }, [text])
}
