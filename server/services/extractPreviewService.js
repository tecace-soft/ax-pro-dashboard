/**
 * Extract-preview: OpenAI structured extraction + ontology normalization.
 * No persistence.
 */

import { normalizeExtractPreviewOntology } from '../ontology/previewOntologyNormalize.js'
import { extractOntologyFromAdminFeedbackWithOpenAI } from './feedbackOntologyOpenAI.js'

/** @typedef {import('../types/ontologyExtractPreview.js').ExtractPreviewInput} ExtractPreviewInput */
/** @typedef {import('../types/ontologyExtractPreview.js').ExtractPreviewResult} ExtractPreviewResult */

/**
 * @param {ExtractPreviewInput} input
 * @returns {Promise<ExtractPreviewResult>}
 */
export async function runExtractPreview(input) {
  const rawBundle = await extractOntologyFromAdminFeedbackWithOpenAI(input)

  const norm = normalizeExtractPreviewOntology({
    entities: rawBundle.entities,
    aliases: rawBundle.aliases,
    relationships: rawBundle.relationships,
    properties: rawBundle.properties
  })

  return {
    source_text: input.source_text,
    entities: norm.entities,
    aliases: norm.aliases,
    relationships: norm.relationships,
    properties: norm.properties,
    warnings: [...rawBundle.warnings, ...norm.warnings]
  }
}
