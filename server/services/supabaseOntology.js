import { createClient } from '@supabase/supabase-js'
import { getServerConfig } from '../config.js'

let _client = null

function getServiceClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig()
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return _client
}

export function isSupabaseOntologyConfigured() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig()
  return Boolean(supabaseUrl && supabaseServiceRoleKey)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {any} error
 */
function wrapSupabaseError(client, table, error) {
  void client
  const msg =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  const e = new Error(msg || `Supabase error on ${table}`)
  e.code = 'SUPABASE_ERROR'
  e.table = table
  e.details = error
  return e
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseServiceClientOrThrow() {
  const client = getServiceClient()
  if (!client) {
    const err = new Error('Supabase service credentials are not configured')
    err.code = 'SUPABASE_NOT_CONFIGURED'
    throw err
  }
  return client
}

/**
 * @param {object} params
 * @param {string} params.workspace_id
 * @param {string} params.source_type
 * @param {string} params.source_text
 * @param {string} params.created_by
 * @param {'draft'|'pending_review'|'approved'|'rejected'|'archived'} params.status
 * @param {string[]} params.ingestion_warnings
 * @param {string} [params.approved_by]
 * @param {string} [params.review_notes]
 * @returns {Promise<{ id: string }>}
 */
export async function createOntologySource(params) {
  const client = getSupabaseServiceClientOrThrow()
  const payload = {
    workspace_id: params.workspace_id,
    source_type: params.source_type,
    source_text: params.source_text,
    created_by: params.created_by,
    status: params.status,
    ingestion_warnings: params.ingestion_warnings,
    approved_at: params.status === 'approved' ? new Date().toISOString() : null,
    approved_by: params.approved_by || null,
    review_notes: params.review_notes || null
  }

  const { data, error } = await client
    .from('ontology_sources')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw wrapSupabaseError(client, 'ontology_sources', error)
  return data
}

/**
 * @param {string} sourceId
 */
export async function deleteOntologySourceCascade(sourceId) {
  const client = getSupabaseServiceClientOrThrow()
  const { error } = await client.from('ontology_sources').delete().eq('id', sourceId)
  if (error) throw wrapSupabaseError(client, 'ontology_sources', error)
}

/**
 * @param {object} params
 * @param {string} params.source_id
 * @param {Array<{ preview_entity_id: string, label: string, entity_type: string, canonical_name?: string }>} params.entities
 * @returns {Promise<Array<{ id: string, preview_entity_id: string }>>}
 */
export async function insertOntologyEntities(params) {
  const client = getSupabaseServiceClientOrThrow()
  if (!params.entities.length) return []

  const { data, error } = await client
    .from('ontology_entities')
    .insert(
      params.entities.map((e) => ({
        source_id: params.source_id,
        preview_entity_id: e.preview_entity_id,
        label: e.label,
        entity_type: e.entity_type,
        canonical_name: e.canonical_name || null,
        status: 'active'
      }))
    )
    .select('id,preview_entity_id')

  if (error) throw wrapSupabaseError(client, 'ontology_entities', error)
  return data || []
}

/**
 * @param {object} params
 * @param {string} params.source_id
 * @param {Array<{ entity_id: string, alias: string }>} params.aliases
 * @returns {Promise<Array<{ id: string, entity_id: string, alias: string }>>}
 */
export async function upsertOntologyAliases(params) {
  const client = getSupabaseServiceClientOrThrow()
  if (!params.aliases.length) return []

  const { data, error } = await client
    .from('ontology_aliases')
    .upsert(
      params.aliases.map((a) => ({
        source_id: params.source_id,
        entity_id: a.entity_id,
        alias: a.alias
      })),
      { onConflict: 'source_id,entity_id,alias', ignoreDuplicates: true }
    )
    .select('id,entity_id,alias')

  if (error) throw wrapSupabaseError(client, 'ontology_aliases', error)
  return data || []
}

/**
 * @param {object} params
 * @param {string} params.source_id
 * @param {Array<{ from_entity_id: string, to_entity_id: string, relation_type: string, confidence?: number }>} params.relationships
 * @returns {Promise<Array<{ id: string }>>}
 */
export async function insertOntologyRelationships(params) {
  const client = getSupabaseServiceClientOrThrow()
  if (!params.relationships.length) return []

  const { data, error } = await client
    .from('ontology_relationships')
    .insert(
      params.relationships.map((r) => ({
        source_id: params.source_id,
        from_entity_id: r.from_entity_id,
        to_entity_id: r.to_entity_id,
        relation_type: r.relation_type,
        confidence: r.confidence ?? null
      }))
    )
    .select('id')

  if (error) throw wrapSupabaseError(client, 'ontology_relationships', error)
  return data || []
}

/**
 * @param {object} params
 * @param {string} params.source_id
 * @param {Array<{ entity_id: string, property_key: string, property_value: string }>} params.properties
 * @returns {Promise<Array<{ id: string, entity_id: string, property_key: string }>>}
 */
export async function upsertOntologyProperties(params) {
  const client = getSupabaseServiceClientOrThrow()
  if (!params.properties.length) return []

  const { data, error } = await client
    .from('ontology_properties')
    .upsert(
      params.properties.map((p) => ({
        source_id: params.source_id,
        entity_id: p.entity_id,
        property_key: p.property_key,
        property_value: p.property_value
      })),
      { onConflict: 'entity_id,property_key' }
    )
    .select('id,entity_id,property_key')

  if (error) throw wrapSupabaseError(client, 'ontology_properties', error)
  return data || []
}

/**
 * Read helpers for conservative merge/conflict detection.
 * These operate at the workspace level by joining ontology_sources.
 */

/**
 * @param {string} workspaceId
 * @param {string[]} canonicalNames lowercased canonical names (exact match)
 * @returns {Promise<Array<{ id: string, label: string, entity_type: string, canonical_name: string }>>}
 */
export async function findWorkspaceEntitiesByCanonicalNames(workspaceId, canonicalNames) {
  const client = getSupabaseServiceClientOrThrow()
  if (!canonicalNames.length) return []

  const { data, error } = await client
    .from('ontology_entities')
    .select('id,label,entity_type,canonical_name,ontology_sources!inner(workspace_id)')
    .eq('ontology_sources.workspace_id', workspaceId)
    .in('canonical_name', canonicalNames)

  if (error) throw wrapSupabaseError(client, 'ontology_entities', error)
  return (data || []).map((r) => ({
    id: r.id,
    label: r.label,
    entity_type: r.entity_type,
    canonical_name: r.canonical_name
  }))
}

/**
 * @param {string} workspaceId
 * @param {string[]} aliasesExact aliases to check (trimmed; exact match)
 * @returns {Promise<Array<{ id: string, entity_id: string, alias: string }>>}
 */
export async function findWorkspaceAliases(workspaceId, aliasesExact) {
  const client = getSupabaseServiceClientOrThrow()
  if (!aliasesExact.length) return []

  const { data, error } = await client
    .from('ontology_aliases')
    .select('id,entity_id,alias,ontology_sources!inner(workspace_id)')
    .eq('ontology_sources.workspace_id', workspaceId)
    .in('alias', aliasesExact)

  if (error) throw wrapSupabaseError(client, 'ontology_aliases', error)
  return (data || []).map((r) => ({ id: r.id, entity_id: r.entity_id, alias: r.alias }))
}

/**
 * @param {string} workspaceId
 * @param {string[]} entityIds entity UUIDs
 * @param {string[]} relationTypes exact match
 * @returns {Promise<Array<{ id: string, from_entity_id: string, to_entity_id: string, relation_type: string }>>}
 */
export async function findWorkspaceRelationships(workspaceId, entityIds, relationTypes) {
  const client = getSupabaseServiceClientOrThrow()
  if (!entityIds.length || !relationTypes.length) return []

  const { data, error } = await client
    .from('ontology_relationships')
    .select('id,from_entity_id,to_entity_id,relation_type,ontology_sources!inner(workspace_id)')
    .eq('ontology_sources.workspace_id', workspaceId)
    .in('from_entity_id', entityIds)
    .in('to_entity_id', entityIds)
    .in('relation_type', relationTypes)

  if (error) throw wrapSupabaseError(client, 'ontology_relationships', error)
  return (data || []).map((r) => ({
    id: r.id,
    from_entity_id: r.from_entity_id,
    to_entity_id: r.to_entity_id,
    relation_type: r.relation_type
  }))
}

/**
 * @param {string} workspaceId
 * @param {string[]} entityIds entity UUIDs
 * @param {string[]} keys property_key exact
 * @returns {Promise<Array<{ id: string, entity_id: string, property_key: string, property_value: string }>>}
 */
export async function findWorkspaceProperties(workspaceId, entityIds, keys) {
  const client = getSupabaseServiceClientOrThrow()
  if (!entityIds.length || !keys.length) return []

  const { data, error } = await client
    .from('ontology_properties')
    .select('id,entity_id,property_key,property_value,ontology_sources!inner(workspace_id)')
    .eq('ontology_sources.workspace_id', workspaceId)
    .in('entity_id', entityIds)
    .in('property_key', keys)

  if (error) throw wrapSupabaseError(client, 'ontology_properties', error)
  return (data || []).map((r) => ({
    id: r.id,
    entity_id: r.entity_id,
    property_key: r.property_key,
    property_value: r.property_value
  }))
}
