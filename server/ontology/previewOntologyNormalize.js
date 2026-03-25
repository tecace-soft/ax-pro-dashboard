/**
 * Pure validation + normalization for extract-preview ontology fragments.
 * Framework-agnostic (no Express).
 */

/** @typedef {import('../types/ontologyExtractPreview.js').OntologyEntityPreview} OntologyEntityPreview */
/** @typedef {import('../types/ontologyExtractPreview.js').OntologyAliasPreview} OntologyAliasPreview */
/** @typedef {import('../types/ontologyExtractPreview.js').OntologyRelationshipPreview} OntologyRelationshipPreview */
/** @typedef {import('../types/ontologyExtractPreview.js').OntologyPropertyPreview} OntologyPropertyPreview */

/** @public Allowed entity_type values after normalization. */
export const ENTITY_TYPES = Object.freeze([
  'benefit',
  'provider',
  'policy',
  'event',
  'system',
  'department',
  'form',
  'term',
  'person'
])

/** @public Allowed relation_type (stored as `relation`) values after normalization. */
export const RELATION_TYPES = Object.freeze([
  'provided_by',
  'uses_system',
  'managed_by',
  'requires_form',
  'part_of',
  'related_to',
  'occurs_on',
  'has_contact'
])

const ENTITY_SET = new Set(ENTITY_TYPES)
const RELATION_SET = new Set(RELATION_TYPES)

const FALLBACK_ENTITY_TYPE = 'term'
const FALLBACK_RELATION_TYPE = 'related_to'

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Trim, split camelCase, hyphen, space into lowercase snake_case.
 * @param {unknown} raw
 * @returns {string}
 */
export function toSnakeCaseIdentifier(raw) {
  if (raw === null || raw === undefined) return ''
  let s = String(raw).trim()
  if (!s) return ''
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  s = s.replace(/[\s-]+/g, '_')
  s = s.replace(/__+/g, '_')
  return s.toLowerCase().replace(/^_|_$/g, '')
}

/**
 * Lowercase enum match for entity_type; unknown → null (caller may fall back).
 * @param {unknown} raw
 * @returns {{ value: string | null, warnings: string[] }}
 */
export function normalizeEntityType(raw) {
  /** @type {string[]} */
  const warnings = []
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, warnings: ['entity_type missing or empty'] }
  }
  const v = String(raw).trim().toLowerCase()
  if (!v) {
    return { value: null, warnings: ['entity_type is whitespace-only'] }
  }
  if (ENTITY_SET.has(v)) {
    return { value: v, warnings }
  }
  warnings.push(
    `entity_type "${String(raw).trim()}" is not in allowed set; will fall back to "${FALLBACK_ENTITY_TYPE}"`
  )
  return { value: null, warnings }
}

/**
 * Normalize relation label to allowed snake_case enum.
 * @param {unknown} raw
 * @returns {{ value: string | null, warnings: string[] }}
 */
export function normalizeRelationType(raw) {
  /** @type {string[]} */
  const warnings = []
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, warnings: ['relation_type missing or empty'] }
  }
  const snake = toSnakeCaseIdentifier(raw)
  if (!snake) {
    return { value: null, warnings: ['relation_type normalizes to empty string'] }
  }
  if (RELATION_SET.has(snake)) {
    return { value: snake, warnings }
  }
  warnings.push(
    `relation_type "${String(raw).trim()}" (${snake}) is not allowed; will fall back to "${FALLBACK_RELATION_TYPE}"`
  )
  return { value: null, warnings }
}

/**
 * Property key → snake_case; empty after normalize yields null.
 * @param {unknown} raw
 * @returns {{ value: string | null, warnings: string[] }}
 */
export function normalizePropertyKey(raw) {
  /** @type {string[]} */
  const warnings = []
  if (raw === null || raw === undefined) {
    return { value: null, warnings: ['property key missing'] }
  }
  const snake = toSnakeCaseIdentifier(raw)
  if (!snake) {
    warnings.push(`property key "${String(raw)}" normalizes to empty snake_case`)
    return { value: null, warnings }
  }
  return { value: snake, warnings }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, entity: OntologyEntityPreview, warnings: string[] } | { ok: false, entity: null, warnings: string[] }}
 */
export function normalizeOntologyEntity(raw) {
  /** @type {string[]} */
  const warnings = []
  if (!isPlainObject(raw)) {
    return { ok: false, entity: null, warnings: ['entity skipped: not a plain object'] }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!id || !label) {
    return {
      ok: false,
      entity: null,
      warnings: ['entity skipped: id and non-empty label are required']
    }
  }

  const typeSource = o.entity_type !== undefined ? o.entity_type : o.type
  const nt = normalizeEntityType(typeSource)
  warnings.push(...nt.warnings)
  const type = nt.value !== null ? nt.value : FALLBACK_ENTITY_TYPE

  return {
    ok: true,
    entity: { id, label, type },
    warnings
  }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, alias: OntologyAliasPreview, warnings: string[] } | { ok: false, alias: null, warnings: string[] }}
 */
export function normalizeOntologyAlias(raw) {
  /** @type {string[]} */
  const warnings = []
  if (!isPlainObject(raw)) {
    return { ok: false, alias: null, warnings: ['alias skipped: not a plain object'] }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  const entity_id = typeof o.entity_id === 'string' ? o.entity_id.trim() : ''
  const alias = typeof o.alias === 'string' ? o.alias.trim() : ''
  if (!entity_id || !alias) {
    return {
      ok: false,
      alias: null,
      warnings: ['alias skipped: entity_id and non-empty alias are required']
    }
  }
  return { ok: true, alias: { entity_id, alias }, warnings }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, relationship: OntologyRelationshipPreview, warnings: string[] } | { ok: false, relationship: null, warnings: string[] }}
 */
export function normalizeOntologyRelationship(raw) {
  /** @type {string[]} */
  const warnings = []
  if (!isPlainObject(raw)) {
    return { ok: false, relationship: null, warnings: ['relationship skipped: not a plain object'] }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  const from = typeof o.from === 'string' ? o.from.trim() : ''
  const to = typeof o.to === 'string' ? o.to.trim() : ''
  if (!from || !to) {
    return {
      ok: false,
      relationship: null,
      warnings: ['relationship skipped: from and to must be non-empty strings']
    }
  }

  const relSource = o.relation_type !== undefined ? o.relation_type : o.relation
  const rt = normalizeRelationType(relSource)
  warnings.push(...rt.warnings)
  const relation = rt.value !== null ? rt.value : FALLBACK_RELATION_TYPE

  /** @type {OntologyRelationshipPreview} */
  const out = { from, to, relation }

  if (o.confidence !== undefined && o.confidence !== null) {
    const c = Number(o.confidence)
    if (!Number.isFinite(c)) {
      warnings.push('relationship: confidence is not a finite number; omitted')
    } else if (c < 0 || c > 1) {
      warnings.push(`relationship: confidence ${c} outside [0,1]; omitted`)
    } else {
      out.confidence = c
    }
  }

  return { ok: true, relationship: out, warnings }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, property: OntologyPropertyPreview, warnings: string[] } | { ok: false, property: null, warnings: string[] }}
 */
export function normalizeOntologyProperty(raw) {
  /** @type {string[]} */
  const warnings = []
  if (!isPlainObject(raw)) {
    return { ok: false, property: null, warnings: ['property skipped: not a plain object'] }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  const entity_id = typeof o.entity_id === 'string' ? o.entity_id.trim() : ''
  const keySource = o.property_key !== undefined ? o.property_key : o.key
  const pk = normalizePropertyKey(keySource)
  warnings.push(...pk.warnings)

  if (!entity_id) {
    return {
      ok: false,
      property: null,
      warnings: ['property skipped: entity_id required']
    }
  }
  if (pk.value === null) {
    return {
      ok: false,
      property: null,
      warnings: warnings.length ? warnings : ['property skipped: invalid key']
    }
  }

  let value = o.value
  if (value === null || value === undefined) {
    value = ''
  } else if (typeof value === 'object') {
    try {
      value = JSON.stringify(value)
      warnings.push(`property ${pk.value}: object value JSON-stringified`)
    } catch {
      warnings.push(`property ${pk.value}: object value could not stringify; using empty string`)
      value = ''
    }
  } else {
    value = String(value).trim()
  }

  return {
    ok: true,
    property: { entity_id, key: pk.value, value },
    warnings
  }
}

/**
 * Normalize arrays and cross-check entity references. Drops dangling aliases/relationships/properties.
 * Pure; never throws on bad input (uses [] defaults).
 *
 * @param {unknown} bundle
 * @returns {{
 *   entities: OntologyEntityPreview[],
 *   aliases: OntologyAliasPreview[],
 *   relationships: OntologyRelationshipPreview[],
 *   properties: OntologyPropertyPreview[],
 *   warnings: string[]
 * }}
 */
export function normalizeExtractPreviewOntology(bundle) {
  /** @type {string[]} */
  const warnings = []
  const b = isPlainObject(bundle) ? bundle : {}

  const rawEntities = Array.isArray(b.entities) ? b.entities : []
  const rawAliases = Array.isArray(b.aliases) ? b.aliases : []
  const rawRelationships = Array.isArray(b.relationships) ? b.relationships : []
  const rawProperties = Array.isArray(b.properties) ? b.properties : []

  if (!Array.isArray(b.entities) && b.entities !== undefined) {
    warnings.push('entities was not an array; treated as empty')
  }
  if (!Array.isArray(b.aliases) && b.aliases !== undefined) {
    warnings.push('aliases was not an array; treated as empty')
  }
  if (!Array.isArray(b.relationships) && b.relationships !== undefined) {
    warnings.push('relationships was not an array; treated as empty')
  }
  if (!Array.isArray(b.properties) && b.properties !== undefined) {
    warnings.push('properties was not an array; treated as empty')
  }

  /** @type {OntologyEntityPreview[]} */
  const entities = []
  /** @type {Set<string>} */
  const seenIds = new Set()

  for (let i = 0; i < rawEntities.length; i++) {
    const r = normalizeOntologyEntity(rawEntities[i])
    warnings.push(...r.warnings.map((w) => `entity[${i}]: ${w}`))
    if (!r.ok || !r.entity) continue
    if (seenIds.has(r.entity.id)) {
      warnings.push(`entity[${i}]: duplicate id "${r.entity.id}" skipped`)
      continue
    }
    seenIds.add(r.entity.id)
    entities.push(r.entity)
  }

  /** @type {OntologyAliasPreview[]} */
  const aliases = []
  for (let i = 0; i < rawAliases.length; i++) {
    const r = normalizeOntologyAlias(rawAliases[i])
    warnings.push(...r.warnings.map((w) => `alias[${i}]: ${w}`))
    if (!r.ok || !r.alias) continue
    if (!seenIds.has(r.alias.entity_id)) {
      warnings.push(
        `alias[${i}]: dropped; entity_id "${r.alias.entity_id}" not found in normalized entities`
      )
      continue
    }
    aliases.push(r.alias)
  }

  /** @type {OntologyRelationshipPreview[]} */
  const relationships = []
  for (let i = 0; i < rawRelationships.length; i++) {
    const r = normalizeOntologyRelationship(rawRelationships[i])
    warnings.push(...r.warnings.map((w) => `relationship[${i}]: ${w}`))
    if (!r.ok || !r.relationship) continue
    const { from, to } = r.relationship
    if (!seenIds.has(from) || !seenIds.has(to)) {
      warnings.push(
        `relationship[${i}]: dropped; endpoint not in entities (from="${from}", to="${to}")`
      )
      continue
    }
    relationships.push(r.relationship)
  }

  /** @type {OntologyPropertyPreview[]} */
  const properties = []
  for (let i = 0; i < rawProperties.length; i++) {
    const r = normalizeOntologyProperty(rawProperties[i])
    warnings.push(...r.warnings.map((w) => `property[${i}]: ${w}`))
    if (!r.ok || !r.property) continue
    if (!seenIds.has(r.property.entity_id)) {
      warnings.push(
        `property[${i}]: dropped; entity_id "${r.property.entity_id}" not in normalized entities`
      )
      continue
    }
    properties.push(r.property)
  }

  return { entities, aliases, relationships, properties, warnings }
}
