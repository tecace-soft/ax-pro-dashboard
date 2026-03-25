/**
 * HTTP handler for POST /api/ontology/approve-and-save.
 *
 * Saves a reviewed/approved ontology to Supabase tables:
 * - ontology_sources
 * - ontology_entities
 * - ontology_aliases
 * - ontology_relationships
 * - ontology_properties
 */

import { validateApproveAndSaveRequestBody } from '../validators/approveAndSaveValidator.js'
import { saveApprovedOntologyWithMerge } from '../services/ontologySaveService.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

/**
 * @param {Request} req
 * @param {Response} res
 */
export async function postApproveAndSave(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const parsed = validateApproveAndSaveRequestBody(req.body)
    if (!parsed.ok) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body failed validation',
          issues: parsed.issues
        }
      })
    }

    const input = parsed.value

    console.log('[ontology approve-and-save]', { requestId, workspace_id: input.workspace_id })

    const saved = await saveApprovedOntologyWithMerge(input)

    return res.status(200).json({ ok: true, ...saved })
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? /** @type {{ code?: string }} */ (err).code : undefined

    if (code === 'SUPABASE_NOT_CONFIGURED') {
      return res.status(503).json({
        ok: false,
        error: { code, message: err instanceof Error ? err.message : 'Supabase is not configured' }
      })
    }

    if (code === 'SUPABASE_ERROR') {
      return res.status(502).json({
        ok: false,
        error: {
          code,
          message: err instanceof Error ? err.message : 'Supabase write failed',
          table:
            err && typeof err === 'object' && 'table' in err ? /** @type {{ table?: string }} */ (err).table : undefined
        }
      })
    }

    console.error('[ontology approve-and-save] unexpected error', err)
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' }
    })
  }
}

