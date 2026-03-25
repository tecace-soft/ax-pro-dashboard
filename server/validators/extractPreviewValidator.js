/**
 * Server-side validation for extract-preview requests.
 */

/** @typedef {import('../types/ontologyExtractPreview.js').ExtractPreviewInput} ExtractPreviewInput */
/** @typedef {import('../types/ontologyExtractPreview.js').ValidationIssue} ValidationIssue */

const MAX_WORKSPACE_ID_LEN = 128
const MAX_CREATED_BY_LEN = 256
const MAX_SOURCE_TEXT_CHARS = 512 * 1024

const SOURCE_TYPES = new Set([
  'text',
  'document',
  'html',
  'markdown',
  'policy',
  'transcript',
  'other'
])

/**
 * @param {unknown} v
 * @returns {string}
 */
function typeOf(v) {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: ExtractPreviewInput } | { ok: false, issues: ValidationIssue[] }}
 */
export function validateExtractPreviewRequestBody(body) {
  /** @type {ValidationIssue[]} */
  const issues = []

  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      issues: [{ path: 'body', message: 'JSON object body is required' }]
    }
  }

  const o = /** @type {Record<string, unknown>} */ (body)

  const workspace_id = o.workspace_id
  const source_type = o.source_type
  const source_text = o.source_text
  const created_by = o.created_by

  if (typeof workspace_id !== 'string') {
    issues.push({
      path: 'workspace_id',
      message: `must be a non-empty string (got ${typeOf(workspace_id)})`
    })
  } else {
    const w = workspace_id.trim()
    if (!w) {
      issues.push({ path: 'workspace_id', message: 'must not be empty' })
    } else if (w.length > MAX_WORKSPACE_ID_LEN) {
      issues.push({
        path: 'workspace_id',
        message: `must be at most ${MAX_WORKSPACE_ID_LEN} characters`
      })
    }
  }

  if (typeof source_type !== 'string') {
    issues.push({
      path: 'source_type',
      message: `must be a string (got ${typeOf(source_type)})`
    })
  } else {
    const st = source_type.trim().toLowerCase()
    if (!st) {
      issues.push({ path: 'source_type', message: 'must not be empty' })
    } else if (!SOURCE_TYPES.has(st)) {
      issues.push({
        path: 'source_type',
        message: `must be one of: ${[...SOURCE_TYPES].sort().join(', ')}`
      })
    }
  }

  if (typeof source_text !== 'string') {
    issues.push({
      path: 'source_text',
      message: `must be a string (got ${typeOf(source_text)})`
    })
  } else {
    const t = source_text
    if (!t.trim()) {
      issues.push({ path: 'source_text', message: 'must not be empty or whitespace-only' })
    } else if (t.length > MAX_SOURCE_TEXT_CHARS) {
      issues.push({
        path: 'source_text',
        message: `must be at most ${MAX_SOURCE_TEXT_CHARS} characters`
      })
    }
  }

  if (typeof created_by !== 'string') {
    issues.push({
      path: 'created_by',
      message: `must be a non-empty string (got ${typeOf(created_by)})`
    })
  } else {
    const c = created_by.trim()
    if (!c) {
      issues.push({ path: 'created_by', message: 'must not be empty' })
    } else if (c.length > MAX_CREATED_BY_LEN) {
      issues.push({
        path: 'created_by',
        message: `must be at most ${MAX_CREATED_BY_LEN} characters`
      })
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  /** @type {ExtractPreviewInput} */
  const value = {
    workspace_id: /** @type {string} */ (typeof workspace_id === 'string' ? workspace_id.trim() : ''),
    source_type: /** @type {string} */ (typeof source_type === 'string' ? source_type.trim().toLowerCase() : ''),
    source_text: /** @type {string} */ (source_text),
    created_by: /** @type {string} */ (typeof created_by === 'string' ? created_by.trim() : '')
  }

  return { ok: true, value }
}
