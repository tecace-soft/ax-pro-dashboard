-- Add canonical_name to ontology_entities for workspace-level dedupe/merge.
-- canonical_name is a conservative, normalized identifier derived from label (snake_case-ish).

ALTER TABLE public.ontology_entities
  ADD COLUMN IF NOT EXISTS canonical_name text;

-- Backfill canonical_name for existing rows.
UPDATE public.ontology_entities
SET canonical_name = lower(
  trim(
    regexp_replace(
      regexp_replace(label, '([a-z0-9])([A-Z])', '\1_\2', 'g'),
      '[\s-]+', '_', 'g'
    )
  )
)
WHERE canonical_name IS NULL OR canonical_name = '';

-- Ensure not-null going forward.
ALTER TABLE public.ontology_entities
  ALTER COLUMN canonical_name SET NOT NULL;

-- Index for fast lookups; workspace filtering is done via join to ontology_sources.
CREATE INDEX IF NOT EXISTS idx_ontology_entities_canonical_name
  ON public.ontology_entities (canonical_name);

