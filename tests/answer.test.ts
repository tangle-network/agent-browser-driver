import { describe, it, expect } from 'vitest'
import { deriveAnswer } from '../src/answer.js'

describe('deriveAnswer', () => {
  it('prefers the completion message when present', () => {
    expect(
      deriveAnswer({ result: 'The pricing page loaded.', goalVerification: { evidence: ['ignored'] } }),
    ).toBe('The pricing page loaded.')
  })

  it('falls back to joined goalVerification evidence when the message is empty', () => {
    expect(
      deriveAnswer({ result: '', goalVerification: { evidence: ['Top 3: A, B, C', 'Read A because reasons'] } }),
    ).toBe('Top 3: A, B, C\nRead A because reasons')
  })

  it('treats a whitespace-only message as empty and uses evidence', () => {
    expect(deriveAnswer({ result: '   ', goalVerification: { evidence: ['real answer'] } })).toBe('real answer')
  })

  it('filters out non-string and blank evidence entries', () => {
    const evidence = ['keep', '', '   ', 42 as unknown as string, null as unknown as string, 'also']
    expect(deriveAnswer({ result: '', goalVerification: { evidence } })).toBe('keep\nalso')
  })

  it('returns undefined when there is neither a message nor evidence', () => {
    expect(deriveAnswer({ result: '', goalVerification: { evidence: [] } })).toBeUndefined()
    expect(deriveAnswer({})).toBeUndefined()
  })

  it('does not throw when result is a non-string value (malformed report)', () => {
    expect(
      deriveAnswer({ result: { some: 'object' } as unknown, goalVerification: { evidence: ['fallback'] } }),
    ).toBe('fallback')
    expect(deriveAnswer({ result: 123 as unknown })).toBeUndefined()
  })

  it('handles missing or null goalVerification and non-array evidence', () => {
    expect(deriveAnswer({ result: 'x' })).toBe('x')
    expect(deriveAnswer({ result: '', goalVerification: null })).toBeUndefined()
    expect(deriveAnswer({ result: '', goalVerification: { evidence: 'not-an-array' } })).toBeUndefined()
  })
})
