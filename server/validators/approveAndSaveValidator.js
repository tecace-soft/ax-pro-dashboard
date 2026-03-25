/**
 * Server-side validation for POST /api/ontology/approve-and-save.
 */

/** @typedef {import('../types/ontologyExtractPreview.js').ValidationIssue} ValidationIssue */

const MAX_SOURCE_TEXT_CHARS = 512 * 1024

/**
 * @param {unknown} v
 * @returns {string}
 */
function typeOf(v) {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: any } | { ok: false, issues: ValidationIssue[] }}
 */
export function validateApproveAndSaveRequestBody(body) {
  /** @type {ValidationIssue[]} */
  const issues = []

  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, issues: [{ path: 'body', message: 'JSON object body is required' }] }
  }

  const o = /** @type {Record<string, unknown>} */ (body)

  const workspace_id = o.workspace_id
  const source_type = o.source_type
  const source_text = o.source_text
  const created_by = o.created_by

  if (typeof workspace_id !== 'string' || !workspace_id.trim()) {
    issues.push({ path: 'workspace_id', message: `must be a non-empty string (got ${typeOf(workspace_id)})` })
  }
  if (typeof source_type !== 'string' || !source_type.trim()) {
    issues.push({ path: 'source_type', message: `must be a non-empty string (got ${typeOf(source_type)})` })
  }
  if (typeof created_by !== 'string' || !created_by.trim()) {
    issues.push({ path: 'created_by', message: `must be a non-empty string (got ${typeOf(created_by)})` })
  }

  if (typeof source_text !== 'string') {
    issues.push({ path: 'source_text', message: `must be a string (got ${typeOf(source_text)})` })
  } else {
    if (!source_text.trim()) {
      issues.push({ path: 'source_text', message: 'must not be empty or whitespace-only' })
    } else if (source_text.length > MAX_SOURCE_TEXT_CHARS) {
      issues.push({ path: 'source_text', message: `must be at most ${MAX_SOURCE_TEXT_CHARS} characters` })
    }
  }

  const entities = o.entities
  const aliases = o.aliases
  const relationships = o.relationships
  const properties = o.properties
  const warnings = o.warnings

  if (entities !== undefined && !Array.isArray(entities)) {
    issues.push({ path: 'entities', message: `must be an array when provided (got ${typeOf(entities)})` })
  }
  if (aliases !== undefined && !Array.isArray(aliases)) {
    issues.push({ path: 'aliases', message: `must be an array when provided (got ${typeOf(aliases)})` })
  }
  if (relationships !== undefined && !Array.isArray(relationships)) {
    issues.push({ path: 'relationships', message: `must be an array when provided (got ${typeOf(relationships)})` })
  }
  if (properties !== undefined && !Array.isArray(properties)) {
    issues.push({ path: 'properties', message: `must be an array when provided (got ${typeOf(properties)})` })
  }
  if (warnings !== undefined && !Array.isArray(warnings)) {
    issues.push({ path: 'warnings', message: `must be an array when provided (got ${typeOf(warnings)})` })
  }

  if (issues.length > 0) return { ok: false, issues }

  // Minimal shape; deep normalization is handled by the pure normalization module.
  const value = {
    workspace_id: workspace_id.trim(),
    source_type: source_type.trim().toLowerCase(),
    source_text: source_text,
    created_by: created_by.trim(),
    entities: Array.isArray(entities) ? entities : [],
    aliases: Array.isArray(aliases) ? aliases : [],
    relationships: Array.isArray(relationships) ? relationships : [],
    properties: Array.isArray(properties) ? properties : [],
    warnings: Array.isArray(warnings) ? warnings.filter((w) => typeof w === 'string') : []
  }

  return { ok: true, value }
}

