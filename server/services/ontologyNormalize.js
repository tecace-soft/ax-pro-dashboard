/**
 * Ontology validation / normalization before extraction or persistence.
 */

/**
 * @param {unknown} draft
 * @returns {{ ok: boolean, normalized: unknown | null, issues: string[] }}
 */
export function validateAndNormalizeOntologyDraft(draft) {
  // TODO(HR AX Pro): Define ontology schema (nodes, edges, properties) and validate against it.
  // TODO: Normalize labels, IDs, language tags, and duplicate handling.
  if (draft === undefined || draft === null) {
    return { ok: false, normalized: null, issues: ['body is required'] }
  }
  return { ok: true, normalized: draft, issues: [] }
}
