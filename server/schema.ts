import { pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const brandVoiceProfiles = pgTable('brand_voice_profiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default('default'),
  tone: text('tone').array(),
  sentenceStyle: text('sentence_style'),
  perspective: text('perspective'),
  forbiddenPhrases: text('forbidden_phrases').array(),
  preferredVocabulary: text('preferred_vocabulary').array(),
  ctaStyle: text('cta_style'),
  proseSummary: text('prose_summary'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const proposals = pgTable('proposals', {
  id: serial('id').primaryKey(),
  company: text('company'),
  projectTitle: text('project_title'),
  briefText: text('brief_text'),
  clientData: jsonb('client_data'),
  projectData: jsonb('project_data'),
  contentData: jsonb('content_data'),
  expandedData: jsonb('expanded_data'),
  designConfig: jsonb('design_config'),
  slidesUrl: text('slides_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
