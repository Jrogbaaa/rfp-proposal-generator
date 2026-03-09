import type { BrandVoiceProfile, ClientInfo, ProjectInfo, ProblemsAndBenefits, ExpandedContent, DesignConfig } from '../types/proposal'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}`)
    return res.json() as Promise<T>
  } catch (err) {
    console.error('[api]', err)
    return null
  }
}

// --- Brand Voice ---

export function getBrandVoice(): Promise<BrandVoiceProfile | null> {
  return request('/brand-voice')
}

export function saveBrandVoice(profile: BrandVoiceProfile): Promise<BrandVoiceProfile | null> {
  return request('/brand-voice', { method: 'POST', body: JSON.stringify(profile) })
}

export function deleteBrandVoice(): Promise<{ ok: boolean } | null> {
  return request('/brand-voice', { method: 'DELETE' })
}

// --- Proposals ---

export interface ProposalSummary {
  id: number
  company: string | null
  projectTitle: string | null
  slidesUrl: string | null
  createdAt: string | null
}

export function listProposals(): Promise<ProposalSummary[] | null> {
  return request('/proposals')
}

export interface CreateProposalPayload {
  company?: string
  projectTitle?: string
  briefText?: string
  clientData?: ClientInfo
  projectData?: ProjectInfo
  contentData?: ProblemsAndBenefits
  expandedData?: ExpandedContent
  designConfig?: DesignConfig
  slidesUrl?: string
}

export function createProposal(payload: CreateProposalPayload): Promise<{ id: number } | null> {
  return request('/proposals', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateProposal(id: number, patch: Partial<CreateProposalPayload>): Promise<{ id: number } | null> {
  return request(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteProposal(id: number): Promise<{ ok: boolean } | null> {
  return request(`/proposals/${id}`, { method: 'DELETE' })
}

export async function warmConnection(): Promise<void> {
  await request('/health')
}
