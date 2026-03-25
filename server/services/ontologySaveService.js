/**
 * Workspace-level conservative save with merge/conflict detection.
 * Pure HTTP-agnostic orchestration (no Express).
 *
 * TODO(HR AX Pro): Replace multi-step writes with a single transactional RPC.
 * TODO: Add stronger canonicalization (language, punctuation, stopwords) and conflict resolution workflows.
 */

import { normalizeExtractPreviewOntology, toSnakeCaseIdentifier } from '../ontology/previewOntologyNormalize.js'
import {
  createOntologySource,
  deleteOntologySourceCascade,
  findWorkspaceAliases,
  findWorkspaceEntitiesByCanonicalNames,
  findWorkspaceProperties,
  findWorkspaceRelationships,
  insertOntologyEntities,
  insertOntologyRelationships,
  upsertOntologyAliases,
  upsertOntologyProperties
} from './supabaseOntology.js'

/**
 * @param {string} label
 */
function canonicalNameFromLabel(label) {
  // Conservative: normalize whitespace + snake_case; stable for exact matching.
  const s = String(label || '').trim().replace(/\s+/g, ' ')
  return toSnakeCaseIdentifier(s) || s.toLowerCase()
}

/**
 * @typedef {object} SaveBucket
 * @property {any[]} created
 * @property {any[]} linked_existing
 * @property {any[]} skipped_duplicate
 * @property {any[]} conflict
 */

/**
 * @typedef {object} OntologySaveResult
 * @property {{ id: string }} source
 * @property {SaveBucket} entities
 * @property {SaveBucket} aliases
 * @property {SaveBucket} relationships
 * @property {SaveBucket} properties
 * @property {string[]} warnings
 */

/**
 * @param {object} input
 * @param {string} input.workspace_id
 * @param {string} input.source_type
 * @param {string} input.source_text
 * @param {string} input.created_by
 * @param {unknown[]} [input.entities]
 * @param {unknown[]} [input.aliases]
 * @param {unknown[]} [input.relationships]
 * @param {unknown[]} [input.properties]
 * @param {string[]} [input.warnings]
 * @returns {Promise<OntologySaveResult>}
 */
export async function saveApprovedOntologyWithMerge(input) {
  const norm = normalizeExtractPreviewOntology({
    entities: Array.isArray(input.entities) ? input.entities : [],
    aliases: Array.isArray(input.aliases) ? input.aliases : [],
    relationships: Array.isArray(input.relationships) ? input.relationships : [],
    properties: Array.isArray(input.properties) ? input.properties : []
  })

  const baseWarnings = [
    ...(Array.isArray(input.warnings) ? input.warnings : []).map((w) => String(w).trim()).filter(Boolean),
    ...norm.warnings
  ]

  // --- entity merge lookup (workspace-level canonical_name) ---
  const desiredCanonical = norm.entities.map((e) => canonicalNameFromLabel(e.label))
  const uniqueCanonical = [...new Set(desiredCanonical)].filter(Boolean)
  const existingEntities = await findWorkspaceEntitiesByCanonicalNames(input.workspace_id, uniqueCanonical)
  /** @type {Map<string, { id: string, entity_type: string, label: string }>} */
  const canonicalToExisting = new Map()
  for (const e of existingEntities) {
    canonicalToExisting.set(String(e.canonical_name), { id: e.id, entity_type: e.entity_type, label: e.label })
  }

  // Create source first (so we have a place to attach new nodes/edges)
  const sourceRow = await createOntologySource({
    workspace_id: input.workspace_id,
    source_type: input.source_type,
    source_text: input.source_text,
    created_by: input.created_by,
    status: 'approved',
    ingestion_warnings: baseWarnings,
    approved_by: input.created_by,
    review_notes: null
  })

  const sourceId = sourceRow.id

  /** @type {OntologySaveResult} */
  const result = {
    source: { id: sourceId },
    entities: { created: [], linked_existing: [], skipped_duplicate: [], conflict: [] },
    aliases: { created: [], linked_existing: [], skipped_duplicate: [], conflict: [] },
    relationships: { created: [], linked_existing: [], skipped_duplicate: [], conflict: [] },
    properties: { created: [], linked_existing: [], skipped_duplicate: [], conflict: [] },
    warnings: baseWarnings
  }

  try {
    /** @type {Map<string, string>} */
    const previewToEntityUuid = new Map()

    // Split entities: create missing, link existing
    const toCreate = []
    for (let i = 0; i < norm.entities.length; i++) {
      const e = norm.entities[i]
      const canonical_name = canonicalNameFromLabel(e.label)
      const existing = canonicalToExisting.get(canonical_name)

      if (existing) {
        previewToEntityUuid.set(e.id, existing.id)
        result.entities.linked_existing.push({
          preview_entity_id: e.id,
          canonical_name,
          existing_entity_id: existing.id,
          existing_label: existing.label,
          existing_entity_type: existing.entity_type
        })

        // Conservative conflict hint: type mismatch across workspace
        const incomingType = String(e.type || '').toLowerCase()
        if (incomingType && existing.entity_type && incomingType !== String(existing.entity_type).toLowerCase()) {
          result.entities.conflict.push({
            preview_entity_id: e.id,
            canonical_name,
            reason: 'ENTITY_TYPE_MISMATCH',
            incoming_entity_type: incomingType,
            existing_entity_type: existing.entity_type,
            existing_entity_id: existing.id
          })
        }
        continue
      }

      toCreate.push({
        preview_entity_id: e.id,
        label: e.label,
        entity_type: String(e.type || 'term').toLowerCase(),
        canonical_name
      })
    }

    // Insert only new entities, in one batch
    const createdEntityRows = await insertOntologyEntities({
      source_id: sourceId,
      entities: toCreate.map((e) => ({
        preview_entity_id: e.preview_entity_id,
        label: e.label,
        entity_type: e.entity_type,
        canonical_name: e.canonical_name
      }))
    })

    for (const row of createdEntityRows) {
      previewToEntityUuid.set(row.preview_entity_id, row.id)
      const created = toCreate.find((x) => x.preview_entity_id === row.preview_entity_id)
      result.entities.created.push({
        id: row.id,
        preview_entity_id: row.preview_entity_id,
        canonical_name: created?.canonical_name || null
      })
    }

    // --- alias merge/conflict detection (workspace-level alias string) ---
    const desiredAliases = norm.aliases.map((a) => a.alias.trim()).filter(Boolean)
    const uniqueAliases = [...new Set(desiredAliases)]
    const existingAliases = await findWorkspaceAliases(input.workspace_id, uniqueAliases)
    /** @type {Map<string, Array<{ id: string, entity_id: string, alias: string }>>} */
    const aliasToExisting = new Map()
    for (const a of existingAliases) {
      const key = a.alias.trim().toLowerCase()
      const arr = aliasToExisting.get(key) || []
      arr.push(a)
      aliasToExisting.set(key, arr)
    }

    const aliasInsert = []
    for (const a of norm.aliases) {
      const entityUuid = previewToEntityUuid.get(a.entity_id) || ''
      if (!entityUuid) continue
      const alias = a.alias.trim()
      if (!alias) continue

      const existing = aliasToExisting.get(alias.toLowerCase()) || []
      const same = existing.find((x) => x.entity_id === entityUuid)
      const other = existing.find((x) => x.entity_id !== entityUuid)

      if (same) {
        result.aliases.skipped_duplicate.push({
          alias,
          entity_id: entityUuid,
          existing_alias_id: same.id
        })
        continue
      }
      if (other) {
        result.aliases.conflict.push({
          alias,
          entity_id: entityUuid,
          conflicting_entity_id: other.entity_id,
          existing_alias_id: other.id,
          reason: 'ALIAS_BELONGS_TO_OTHER_ENTITY'
        })
        continue
      }

      aliasInsert.push({ entity_id: entityUuid, alias })
    }

    const insertedAliases = await upsertOntologyAliases({ source_id: sourceId, aliases: aliasInsert })
    for (const row of insertedAliases) {
      result.aliases.created.push(row)
    }

    // --- relationships: skip duplicates if already exists in workspace ---
    const entityUuids = [...new Set([...previewToEntityUuid.values()])]
    const desiredRelTypes = [...new Set(norm.relationships.map((r) => String(r.relation || '').trim()).filter(Boolean))]
    const existingRels = await findWorkspaceRelationships(input.workspace_id, entityUuids, desiredRelTypes)
    const relKey = new Set(existingRels.map((r) => `${r.from_entity_id}::${r.to_entity_id}::${r.relation_type}`))

    const relInsert = []
    for (const r of norm.relationships) {
      const fromId = previewToEntityUuid.get(r.from) || ''
      const toId = previewToEntityUuid.get(r.to) || ''
      const relation_type = String(r.relation || '').trim()
      if (!fromId || !toId || !relation_type) continue

      const k = `${fromId}::${toId}::${relation_type}`
      if (relKey.has(k)) {
        result.relationships.skipped_duplicate.push({ from_entity_id: fromId, to_entity_id: toId, relation_type })
        continue
      }
      relKey.add(k)
      relInsert.push({ from_entity_id: fromId, to_entity_id: toId, relation_type, confidence: r.confidence })
    }

    const insertedRels = await insertOntologyRelationships({ source_id: sourceId, relationships: relInsert })
    for (const row of insertedRels) result.relationships.created.push(row)

    // --- properties: conflict when key exists and value differs ---
    const desiredKeys = [...new Set(norm.properties.map((p) => String(p.key || '').trim()).filter(Boolean))]
    const existingProps = await findWorkspaceProperties(input.workspace_id, entityUuids, desiredKeys)
    /** @type {Map<string, { id: string, value: string }>} */
    const propMap = new Map()
    for (const p of existingProps) {
      propMap.set(`${p.entity_id}::${p.property_key}`, { id: p.id, value: p.property_value })
    }

    const propInsert = []
    for (const p of norm.properties) {
      const entityUuid = previewToEntityUuid.get(p.entity_id) || ''
      if (!entityUuid) continue
      const key = String(p.key || '').trim()
      if (!key) continue
      const value = String(p.value ?? '').trim()

      const existing = propMap.get(`${entityUuid}::${key}`)
      if (existing) {
        if (String(existing.value ?? '') === value) {
          result.properties.skipped_duplicate.push({
            entity_id: entityUuid,
            property_key: key,
            existing_property_id: existing.id
          })
        } else {
          result.properties.conflict.push({
            entity_id: entityUuid,
            property_key: key,
            incoming_value: value,
            existing_value: existing.value,
            existing_property_id: existing.id,
            reason: 'PROPERTY_VALUE_CONFLICT'
          })
        }
        continue
      }

      propMap.set(`${entityUuid}::${key}`, { id: 'pending', value })
      propInsert.push({ entity_id: entityUuid, property_key: key, property_value: value })
    }

    // NOTE: we only insert non-conflicting new properties. We do NOT overwrite existing values in v1.
    const insertedProps = await upsertOntologyProperties({ source_id: sourceId, properties: propInsert })
    for (const row of insertedProps) result.properties.created.push(row)

    return result
  } catch (err) {
    // rollback partial source children
    try {
      await deleteOntologySourceCascade(sourceId)
    } catch (cleanupErr) {
      // keep original error; rollback failure logged by controller
      const e = new Error('Rollback failed after save error')
      e.code = 'ROLLBACK_FAILED'
      e.cause = cleanupErr
      console.error('[ontology save] rollback failed', e)
    }
    throw err
  }
}

