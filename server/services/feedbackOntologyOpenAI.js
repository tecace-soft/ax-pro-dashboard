/**
 * OpenAI structured extraction for HR admin-feedback ontology (backend only).
 */

import OpenAI from 'openai'
import { getServerConfig } from '../config.js'
import {
  HR_FEEDBACK_ONTOLOGY_SYSTEM_PROMPT,
  HR_FEEDBACK_ONTOLOGY_RESPONSE_FORMAT,
  buildHrFeedbackOntologyUserContent
} from '../prompts/hrFeedbackOntology.js'

/** @typedef {import('../types/ontologyExtractPreview.js').ExtractPreviewInput} ExtractPreviewInput */

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Best-effort coerce model JSON into extraction shape; never throws.
 * @param {unknown} parsed
 * @returns {{ bundle: { entities: unknown[], aliases: unknown[], relationships: unknown[], properties: unknown[] }, coerceWarnings: string[] }}
 */
export function coerceModelOntologyPayload(parsed) {
  /** @type {string[]} */
  const coerceWarnings = []

  if (!isPlainObject(parsed)) {
    coerceWarnings.push('Model output was not a JSON object; all arrays cleared.')
    return {
      bundle: { entities: [], aliases: [], relationships: [], properties: [] },
      coerceWarnings
    }
  }

  const p = /** @type {Record<string, unknown>} */ (parsed)

  /** @param {string} key */
  const asArray = (key) => {
    const v = p[key]
    if (v === undefined) {
      coerceWarnings.push(`Missing "${key}"; treated as [].`)
      return []
    }
    if (!Array.isArray(v)) {
      coerceWarnings.push(`"${key}" was not an array; treated as [].`)
      return []
    }
    return v
  }

  return {
    bundle: {
      entities: asArray('entities'),
      aliases: asArray('aliases'),
      relationships: asArray('relationships'),
      properties: asArray('properties')
    },
    coerceWarnings
  }
}

/**
 * @param {unknown} parsed
 * @returns {string[]}
 */
function extractModelWarnings(parsed) {
  if (!isPlainObject(parsed)) return []
  const w = /** @type {Record<string, unknown>} */ (parsed).warnings
  if (!Array.isArray(w)) return []
  return w.filter((x) => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
}

/**
 * Calls OpenAI with structured JSON schema; returns raw-ish bundle for downstream normalization.
 *
 * @param {ExtractPreviewInput} input
 * @returns {Promise<{ entities: unknown[], aliases: unknown[], relationships: unknown[], properties: unknown[], warnings: string[] }>}
 */
export async function extractOntologyFromAdminFeedbackWithOpenAI(input) {
  const cfg = getServerConfig()
  if (!cfg.openaiApiKey) {
    const e = new Error('OPENAI_API_KEY is not configured')
    /** @type {{ code?: string }} */ (e).code = 'OPENAI_NOT_CONFIGURED'
    throw e
  }

  const { text: userContent, truncationWarnings } = buildHrFeedbackOntologyUserContent(input)

  const client = new OpenAI({
    apiKey: cfg.openaiApiKey,
    maxRetries: 1,
    timeout: 120_000
  })

  let completion
  try {
    completion = await client.chat.completions.create({
      model: cfg.openaiModel,
      messages: [
        { role: 'system', content: HR_FEEDBACK_ONTOLOGY_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: HR_FEEDBACK_ONTOLOGY_RESPONSE_FORMAT
      },
      temperature: 0.1,
      max_completion_tokens: 8192
    })
  } catch (err) {
    const e = new Error(
      err instanceof Error ? err.message : 'OpenAI request failed'
    )
    /** @type {{ code?: string, cause?: unknown }} */ (e).code = 'OPENAI_UPSTREAM'
    /** @type {{ cause?: unknown }} */ (e).cause = err
    throw e
  }

  const choice = completion.choices[0]
  if (!choice) {
    const e = new Error('OpenAI returned no choices')
    /** @type {{ code?: string }} */ (e).code = 'OPENAI_INVALID_RESPONSE'
    throw e
  }

  const msg = choice.message
  if (msg && 'refusal' in msg && msg.refusal) {
    const e = new Error(String(msg.refusal))
    /** @type {{ code?: string }} */ (e).code = 'OPENAI_REFUSAL'
    throw e
  }

  const rawContent = msg?.content
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    const e = new Error('OpenAI returned empty content')
    /** @type {{ code?: string }} */ (e).code = 'OPENAI_INVALID_RESPONSE'
    throw e
  }

  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    const e = new Error('OpenAI content was not valid JSON')
    /** @type {{ code?: string }} */ (e).code = 'OPENAI_INVALID_RESPONSE'
    throw e
  }

  const modelWarnings = extractModelWarnings(parsed)
  const { bundle, coerceWarnings } = coerceModelOntologyPayload(parsed)

  /** @type {string[]} */
  const warnings = [
    ...truncationWarnings,
    ...coerceWarnings,
    ...modelWarnings
  ]

  return {
    entities: bundle.entities,
    aliases: bundle.aliases,
    relationships: bundle.relationships,
    properties: bundle.properties,
    warnings
  }
}
