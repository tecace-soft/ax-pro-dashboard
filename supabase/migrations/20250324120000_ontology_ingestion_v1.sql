-- Ontology ingestion v1: approved extractions from HR admin feedback only.
-- Aligns with server extract-preview payload: entities (id, label, type), aliases (entity_id, alias),
-- relationships (from, to, relation, confidence?), properties (entity_id, key, value).
-- RLS: add policies per project; service role bypasses RLS for backend ingestion.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_ontology_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- ontology_sources: one row per admin-feedback ingestion / approval unit
-- ---------------------------------------------------------------------------
CREATE TABLE public.ontology_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id text NOT NULL,
  source_type text NOT NULL,
  source_text text NOT NULL,
  created_by text NOT NULL,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),

  -- Snapshot of extraction/normalization warnings at save time (JSON array of strings)
  ingestion_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,

  approved_at timestamptz,
  approved_by text,
  review_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ontology_sources_workspace_status
  ON public.ontology_sources (workspace_id, status);

CREATE INDEX idx_ontology_sources_created_at
  ON public.ontology_sources (created_at DESC);

CREATE INDEX idx_ontology_sources_created_by
  ON public.ontology_sources (created_by);

COMMENT ON TABLE public.ontology_sources IS
  'Root record for one admin-feedback ontology: raw text, workspace, lifecycle (draft → approved). Child rows hang off source_id.';

CREATE TRIGGER trg_ontology_sources_updated_at
  BEFORE UPDATE ON public.ontology_sources
  FOR EACH ROW EXECUTE PROCEDURE public.set_ontology_updated_at();

-- ---------------------------------------------------------------------------
-- ontology_entities: normalized entities for a source (maps entities[].id → preview_entity_id)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ontology_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.ontology_sources (id) ON DELETE CASCADE,

  preview_entity_id text NOT NULL,
  label text NOT NULL,
  entity_type text NOT NULL,

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_id, preview_entity_id)
);

CREATE INDEX idx_ontology_entities_source
  ON public.ontology_entities (source_id);

CREATE INDEX idx_ontology_entities_type
  ON public.ontology_entities (source_id, entity_type);

COMMENT ON TABLE public.ontology_entities IS
  'Extracted HR concepts for one source. preview_entity_id matches extraction payload entities[].id for joining aliases/edges/properties.';

CREATE TRIGGER trg_ontology_entities_updated_at
  BEFORE UPDATE ON public.ontology_entities
  FOR EACH ROW EXECUTE PROCEDURE public.set_ontology_updated_at();

-- ---------------------------------------------------------------------------
-- ontology_aliases: alternate names (payload: entity_id → FK via preview mapping at insert time)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ontology_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.ontology_sources (id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ontology_entities (id) ON DELETE CASCADE,

  alias text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_id, entity_id, alias)
);

CREATE INDEX idx_ontology_aliases_source
  ON public.ontology_aliases (source_id);

CREATE INDEX idx_ontology_aliases_entity
  ON public.ontology_aliases (entity_id);

CREATE INDEX idx_ontology_aliases_alias_lower
  ON public.ontology_aliases (source_id, lower(alias));

COMMENT ON TABLE public.ontology_aliases IS
  'Synonyms / abbreviations from extraction; entity_id is the persisted ontology_entities row, not the preview string id.';

-- ---------------------------------------------------------------------------
-- ontology_relationships: directed edges (payload from/to → entity UUIDs at insert time)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ontology_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.ontology_sources (id) ON DELETE CASCADE,

  from_entity_id uuid NOT NULL REFERENCES public.ontology_entities (id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES public.ontology_entities (id) ON DELETE CASCADE,

  relation_type text NOT NULL,
  confidence numeric(5, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX idx_ontology_relationships_source
  ON public.ontology_relationships (source_id);

CREATE INDEX idx_ontology_relationships_from
  ON public.ontology_relationships (from_entity_id);

CREATE INDEX idx_ontology_relationships_to
  ON public.ontology_relationships (to_entity_id);

CREATE INDEX idx_ontology_relationships_type
  ON public.ontology_relationships (source_id, relation_type);

COMMENT ON TABLE public.ontology_relationships IS
  'Typed edges between entities within one source; relation_type matches normalized extraction enum (snake_case).';

-- ---------------------------------------------------------------------------
-- ontology_properties: key/value facts on entities (payload key → property_key)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ontology_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.ontology_sources (id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ontology_entities (id) ON DELETE CASCADE,

  property_key text NOT NULL,
  property_value text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (entity_id, property_key)
);

CREATE INDEX idx_ontology_properties_source
  ON public.ontology_properties (source_id);

CREATE INDEX idx_ontology_properties_entity
  ON public.ontology_properties (entity_id);

CREATE INDEX idx_ontology_properties_key
  ON public.ontology_properties (source_id, property_key);

COMMENT ON TABLE public.ontology_properties IS
  'Literal attributes tied to an entity; property_key is snake_case per normalization. One row per (entity, key) in v1.';
