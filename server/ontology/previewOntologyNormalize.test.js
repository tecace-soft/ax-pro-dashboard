import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ENTITY_TYPES,
  RELATION_TYPES,
  isPlainObject,
  toSnakeCaseIdentifier,
  normalizeEntityType,
  normalizeRelationType,
  normalizePropertyKey,
  normalizeOntologyEntity,
  normalizeOntologyAlias,
  normalizeOntologyRelationship,
  normalizeOntologyProperty,
  normalizeExtractPreviewOntology
} from './previewOntologyNormalize.js'

describe('previewOntologyNormalize', () => {
  it('exports frozen enum lists', () => {
    assert.ok(ENTITY_TYPES.includes('policy'))
    assert.ok(RELATION_TYPES.includes('provided_by'))
  })

  it('isPlainObject', () => {
    assert.equal(isPlainObject({}), true)
    assert.equal(isPlainObject(null), false)
    assert.equal(isPlainObject([]), false)
  })

  it('toSnakeCaseIdentifier handles camelCase and spaces', () => {
    assert.equal(toSnakeCaseIdentifier('ProvidedBy'), 'provided_by')
    assert.equal(toSnakeCaseIdentifier('  Uses System '), 'uses_system')
    assert.equal(toSnakeCaseIdentifier('has-contact'), 'has_contact')
  })

  it('normalizeEntityType lowercases allowed values', () => {
    const a = normalizeEntityType('POLICY')
    assert.equal(a.value, 'policy')
    assert.equal(a.warnings.length, 0)
  })

  it('normalizeEntityType unknown yields null + warning', () => {
    const a = normalizeEntityType('dragon')
    assert.equal(a.value, null)
    assert.ok(a.warnings.some((w) => w.includes('fall back')))
  })

  it('normalizeRelationType maps synonyms via snake_case', () => {
    const a = normalizeRelationType('ProvidedBy')
    assert.equal(a.value, 'provided_by')
  })

  it('normalizeRelationType unknown yields null + warning', () => {
    const a = normalizeRelationType('eats_pizza')
    assert.equal(a.value, null)
  })

  it('normalizePropertyKey', () => {
    const a = normalizePropertyKey('Effective Date')
    assert.equal(a.value, 'effective_date')
    const b = normalizePropertyKey('')
    assert.equal(b.value, null)
  })

  it('normalizeOntologyEntity accepts entity_type field', () => {
    const r = normalizeOntologyEntity({
      id: 'e1',
      label: ' PTO ',
      entity_type: 'Benefit'
    })
    assert.equal(r.ok, true)
    assert.equal(r.entity?.type, 'benefit')
  })

  it('normalizeOntologyEntity falls back type for unknown', () => {
    const r = normalizeOntologyEntity({ id: 'e1', label: 'x', type: 'unknownThing' })
    assert.equal(r.ok, true)
    assert.equal(r.entity?.type, 'term')
    assert.ok(r.warnings.length > 0)
  })

  it('normalizeOntologyRelationship uses relation_type and fallback', () => {
    const good = normalizeOntologyRelationship({
      from: 'a',
      to: 'b',
      relation_type: 'part_of',
      confidence: 0.5
    })
    assert.equal(good.ok, true)
    assert.equal(good.relationship?.relation, 'part_of')

    const badRel = normalizeOntologyRelationship({
      from: 'a',
      to: 'b',
      relation: 'nope'
    })
    assert.equal(badRel.ok, true)
    assert.equal(badRel.relationship?.relation, 'related_to')
  })

  it('normalizeOntologyRelationship omits bad confidence with warning', () => {
    const r = normalizeOntologyRelationship({
      from: 'a',
      to: 'b',
      relation: 'related_to',
      confidence: 9
    })
    assert.equal(r.relationship?.confidence, undefined)
    assert.ok(r.warnings.some((w) => w.includes('confidence')))
  })

  it('normalizeExtractPreviewOntology drops dangling edges and bad arrays', () => {
    const out = normalizeExtractPreviewOntology({
      entities: 'bad',
      aliases: [{ entity_id: 'missing', alias: 'a' }],
      relationships: [
        { from: 'e1', to: 'e2', relation: 'related_to' },
        { from: 'e1', to: 'ghost', relation: 'related_to' }
      ],
      properties: []
    })
    assert.ok(out.warnings.some((w) => w.includes('entities was not an array')))
    assert.equal(out.entities.length, 0)
    assert.equal(out.aliases.length, 0)
    assert.equal(out.relationships.length, 0)
  })

  it('normalizeExtractPreviewOntology resolves happy path', () => {
    const out = normalizeExtractPreviewOntology({
      entities: [
        { id: 'e1', label: 'Acme', type: 'provider' },
        { id: 'e2', label: 'Health plan', entity_type: 'benefit' }
      ],
      aliases: [{ entity_id: 'e1', alias: ' ACME ' }],
      relationships: [{ from: 'e1', to: 'e2', relation_type: 'provided_by' }],
      properties: [{ entity_id: 'e2', property_key: 'Plan Year', value: 2025 }]
    })
    assert.equal(out.entities.length, 2)
    assert.equal(out.aliases[0].alias, 'ACME')
    assert.equal(out.relationships[0].relation, 'provided_by')
    assert.equal(out.properties[0].key, 'plan_year')
    assert.equal(out.properties[0].value, '2025')
  })

  it('normalizeExtractPreviewOntology skips duplicate entity ids', () => {
    const out = normalizeExtractPreviewOntology({
      entities: [
        { id: 'x', label: 'first', type: 'term' },
        { id: 'x', label: 'second', type: 'term' }
      ]
    })
    assert.equal(out.entities.length, 1)
    assert.equal(out.entities[0].label, 'first')
  })
})
