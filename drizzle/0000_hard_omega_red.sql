CREATE TABLE "brand_voice_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"tone" text[],
	"sentence_style" text,
	"perspective" text,
	"forbidden_phrases" text[],
	"preferred_vocabulary" text[],
	"cta_style" text,
	"prose_summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" text,
	"project_title" text,
	"brief_text" text,
	"client_data" jsonb,
	"project_data" jsonb,
	"content_data" jsonb,
	"expanded_data" jsonb,
	"design_config" jsonb,
	"slides_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
