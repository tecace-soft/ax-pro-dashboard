import { Router } from 'express'
import { getServerConfig } from '../config.js'
import { postExtractPreview } from '../controllers/extractPreviewController.js'
import { postApproveAndSave } from '../controllers/approveAndSaveController.js'
import { isSupabaseOntologyConfigured } from '../services/supabaseOntology.js'
// NOTE: keep route file thin; per-endpoint validation lives in controllers/validators.

const router = Router()

/**
 * GET /api/ontology/health
 */
router.get('/health', (_req, res) => {
  const cfg = getServerConfig()
  res.json({
    ok: true,
    service: 'ontology',
    openaiConfigured: Boolean(cfg.openaiApiKey),
    supabaseConfigured: isSupabaseOntologyConfigured(),
    backendRelaxedEnv: cfg.backendRelaxedEnv
  })
})

/**
 * POST /api/ontology/extract-preview
 * @see ../controllers/extractPreviewController.js
 */
router.post('/extract-preview', postExtractPreview)

/**
 * POST /api/ontology/approve-and-save
 * @see ../controllers/approveAndSaveController.js
 */
router.post('/approve-and-save', postApproveAndSave)

// Prevent unknown /api/ontology/* from falling through to the external /api proxy.
router.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Unknown ontology route' }
  })
})

export default router
