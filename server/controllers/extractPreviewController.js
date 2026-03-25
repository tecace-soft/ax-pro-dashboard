/**
 * HTTP handler for POST /api/ontology/extract-preview.
 */

import { validateExtractPreviewRequestBody } from '../validators/extractPreviewValidator.js'
import { runExtractPreview } from '../services/extractPreviewService.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

/**
 * @param {Request} req
 * @param {Response} res
 */
export async function postExtractPreview(req, res) {
  try {
    const parsed = validateExtractPreviewRequestBody(req.body)
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

    const result = await runExtractPreview(parsed.value)

    return res.status(200).json({
      ok: true,
      ...result
    })
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? /** @type {{ code?: string }} */ (err).code : undefined

    if (code === 'OPENAI_NOT_CONFIGURED') {
      console.error('[extract-preview]', err)
      return res.status(503).json({
        ok: false,
        error: {
          code: 'OPENAI_NOT_CONFIGURED',
          message: err instanceof Error ? err.message : 'OpenAI is not configured'
        }
      })
    }

    if (code === 'OPENAI_UPSTREAM') {
      console.error('[extract-preview] OpenAI upstream error', err)
      return res.status(502).json({
        ok: false,
        error: {
          code: 'OPENAI_UPSTREAM',
          message: err instanceof Error ? err.message : 'OpenAI request failed'
        }
      })
    }

    if (code === 'OPENAI_REFUSAL' || code === 'OPENAI_INVALID_RESPONSE') {
      console.error('[extract-preview]', code, err)
      return res.status(502).json({
        ok: false,
        error: {
          code: code || 'OPENAI_BAD_RESPONSE',
          message: err instanceof Error ? err.message : 'Unexpected OpenAI response'
        }
      })
    }

    console.error('[extract-preview]', err)
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during extract preview'
      }
    })
  }
}
