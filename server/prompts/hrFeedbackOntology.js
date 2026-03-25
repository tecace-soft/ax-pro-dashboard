/**
 * System prompt + JSON schema for HR admin-feedback → ontology extraction (OpenAI structured output).
 * Backend only; never import from frontend code.
 */

/** JSON Schema object passed inside `response_format.json_schema.schema`. */
export const HR_FEEDBACK_ONTOLOGY_ROOT_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      description:
        'Concepts explicitly named or clearly referenced in the feedback. No invented HR objects.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable local id (e.g. ent_1). Unique within this extraction.'
          },
          label: { type: 'string', description: 'Human-readable name as supported by the text.' },
          type: {
            type: 'string',
            description:
              'One of: benefit, provider, policy, event, system, department, form, term, person'
          }
        },
        required: ['id', 'label', 'type'],
        additionalProperties: false
      }
    },
    aliases: {
      type: 'array',
      description: 'Alternate names, abbreviations, or synonyms stated in the text.',
      items: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Must match an entities[].id' },
          alias: { type: 'string', description: 'Alternate string from or grounded in the text.' }
        },
        required: ['entity_id', 'alias'],
        additionalProperties: false
      }
    },
    relationships: {
      type: 'array',
      description: 'Directed links only when the feedback clearly supports them.',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source entity id.' },
          to: { type: 'string', description: 'Target entity id.' },
          relation: {
            type: 'string',
            description:
              'One of: provided_by, uses_system, managed_by, requires_form, part_of, related_to, occurs_on, has_contact'
          }
        },
        required: ['from', 'to', 'relation'],
        additionalProperties: false
      }
    },
    properties: {
      type: 'array',
      description: 'Factual attributes literally stated or unambiguously implied in the text.',
      items: {
        type: 'object',
        properties: {
          entity_id: { type: 'string' },
          key: { type: 'string', description: 'Short attribute name in snake_case if possible.' },
          value: { type: 'string', description: 'String value; empty if unknown.' }
        },
        required: ['entity_id', 'key', 'value'],
        additionalProperties: false
      }
    },
    warnings: {
      type: 'array',
      description: 'Ambiguity, omissions, or items you chose to skip rather than guess.',
      items: { type: 'string' }
    }
  },
  required: ['entities', 'aliases', 'relationships', 'properties', 'warnings'],
  additionalProperties: false
}

/**
 * OpenAI `response_format.json_schema` wrapper (name, strict, schema).
 */
export const HR_FEEDBACK_ONTOLOGY_RESPONSE_FORMAT = {
  name: 'hr_feedback_ontology',
  strict: true,
  schema: HR_FEEDBACK_ONTOLOGY_ROOT_SCHEMA
}

/**
 * System instructions: conservative extraction from supervisor / admin feedback only.
 */
export const HR_FEEDBACK_ONTOLOGY_SYSTEM_PROMPT = `You are an ontology extraction assistant for HR AX Pro. Your input is supervisor or admin feedback about the chatbot or HR content.

GROUND TRUTH
- Use ONLY information that is explicitly stated or clearly and directly expressed in the admin feedback text.
- Do NOT invent departments, systems, vendors, policies, forms, benefits, dates, or people that are not grounded in that text.
- If you are unsure whether something belongs in the ontology, OMIT it and add a short note to the "warnings" array instead of guessing.

OUTPUT
- Return a single JSON object matching the provided schema (no markdown, no commentary outside JSON).
- "entities": distinct HR-related concepts that the text actually refers to (products, policies, teams, tools, forms, benefits, events, glossary terms, individuals when named, etc.).
- "aliases": abbreviations, alternate names, or synonyms that appear in the text OR are explicitly introduced as equivalent (e.g. "aka", "short for"). Link each alias to an entity id you already emitted.
- "relationships": use ONLY the allowed relation verbs from the schema. Create an edge only if the text clearly supports direction and meaning. If direction is unclear, omit the relationship and warn.
- "properties": key/value attributes explicitly stated in the text for a specific entity (e.g. deadline, owner, system name). Do not infer sensitive attributes.
- "warnings": ambiguity, truncation concerns, conflicting statements, or anything you deliberately omitted to avoid hallucination.

ENTITY TYPES (exactly one per entity, lowercase)
benefit, provider, policy, event, system, department, form, term, person

RELATION TYPES (exactly one per relationship, lowercase snake_case as listed in schema)
provided_by, uses_system, managed_by, requires_form, part_of, related_to, occurs_on, has_contact

IDENTIFIERS
- Use concise ids like ent_1, ent_2. Ensure every entity_id in aliases, relationships, and properties references an existing entities[].id.

When the feedback is empty of extractable structure, return empty arrays and explain in warnings.`

const MAX_FEEDBACK_CHARS_FOR_MODEL = 120_000

/**
 * @param {object} input
 * @param {string} input.source_text
 * @param {string} input.workspace_id
 * @param {string} input.source_type
 * @param {string} input.created_by
 * @returns {{ text: string, truncationWarnings: string[] }}
 */
export function buildHrFeedbackOntologyUserContent(input) {
  /** @type {string[]} */
  const truncationWarnings = []
  let body = input.source_text
  if (body.length > MAX_FEEDBACK_CHARS_FOR_MODEL) {
    body = body.slice(0, MAX_FEEDBACK_CHARS_FOR_MODEL)
    truncationWarnings.push(
      `Feedback truncated to ${MAX_FEEDBACK_CHARS_FOR_MODEL} characters before model call (${input.source_text.length} total).`
    )
  }

  const text = [
    'Extract the ontology from the admin feedback block below.',
    '',
    'METADATA (traceability only — do not create entities or properties from metadata unless the feedback text explicitly repeats or depends on them):',
    `- workspace_id: ${input.workspace_id}`,
    `- source_type: ${input.source_type}`,
    `- created_by: ${input.created_by}`,
    '',
    '--- ADMIN FEEDBACK ---',
    body,
    '--- END ---'
  ].join('\n')

  return { text, truncationWarnings }
}
