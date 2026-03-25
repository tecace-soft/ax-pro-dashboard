import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { coerceModelOntologyPayload } from './feedbackOntologyOpenAI.js'

describe('coerceModelOntologyPayload', () => {
  it('clears when root is not an object', () => {
    const { bundle, coerceWarnings } = coerceModelOntologyPayload(null)
    assert.equal(bundle.entities.length, 0)
    assert.ok(coerceWarnings.length > 0)
  })

  it('coerces non-arrays', () => {
    const { bundle, coerceWarnings } = coerceModelOntologyPayload({
      entities: 'nope',
      aliases: [],
      relationships: [],
      properties: []
    })
    assert.deepEqual(bundle.entities, [])
    assert.ok(coerceWarnings.some((w) => w.includes('entities')))
  })

  it('preserves valid arrays', () => {
    const { bundle } = coerceModelOntologyPayload({
      entities: [{ id: 'e1', label: 'x', type: 'term' }],
      aliases: [],
      relationships: [],
      properties: [],
      warnings: []
    })
    assert.equal(bundle.entities.length, 1)
  })
})
