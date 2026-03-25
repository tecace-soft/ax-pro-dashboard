/**
 * @fileoverview TypeScript-style JSDoc contracts for POST /api/ontology/extract-preview.
 * No runtime values; documents shapes for validators, services, and controllers.
 */

/**
 * Allowed values for `source_type` on the extract-preview request.
 * @typedef {'text' | 'document' | 'html' | 'markdown' | 'policy' | 'transcript' | 'other'} ExtractPreviewSourceType
 */

/**
 * JSON body for POST /api/ontology/extract-preview.
 * @typedef {object} ExtractPreviewRequestBody
 * @property {string} workspace_id
 * @property {string} source_type
 * @property {string} source_text
 * @property {string} created_by
 */

/**
 * Normalized input after validation (trimmed strings).
 * @typedef {object} ExtractPreviewInput
 * @property {string} workspace_id
 * @property {string} source_type
 * @property {string} source_text
 * @property {string} created_by
 */

/**
 * @typedef {object} ValidationIssue
 * @property {string} path dot-path, e.g. `source_text`
 * @property {string} message human-readable message
 */

/**
 * @typedef {object} OntologyEntityPreview
 * @property {string} id stable id within this preview (not persisted)
 * @property {string} label
 * @property {string} [type] entity type / class hint
 */

/**
 * @typedef {object} OntologyAliasPreview
 * @property {string} entity_id references {@link OntologyEntityPreview.id}
 * @property {string} alias
 */

/**
 * @typedef {object} OntologyRelationshipPreview
 * @property {string} from entity id
 * @property {string} to entity id
 * @property {string} relation predicate / edge label
 * @property {number} [confidence] 0–1 when available
 */

/**
 * @typedef {object} OntologyPropertyPreview
 * @property {string} entity_id
 * @property {string} key
 * @property {string} value
 */

/**
 * Non-fatal extraction notes (e.g. truncation, mock mode, low confidence).
 * @typedef {string} ExtractPreviewWarning
 */

/**
 * Successful extract-preview payload (no persistence).
 * @typedef {object} ExtractPreviewResult
 * @property {string} source_text echoed normalized text (or excerpt metadata in warnings)
 * @property {OntologyEntityPreview[]} entities
 * @property {OntologyAliasPreview[]} aliases
 * @property {OntologyRelationshipPreview[]} relationships
 * @property {OntologyPropertyPreview[]} properties
 * @property {ExtractPreviewWarning[]} warnings
 */

export {}
