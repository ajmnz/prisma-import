import { describe, expect, it } from '@jest/globals'
import { asArray } from './util'

describe('util', () => {
  it('should be undefined', () => {
    const input = undefined
    const expectedValue = undefined

    expect(asArray(input)).toEqual(expectedValue)
  })

  it('should be undefined', () => {
    const input = null
    const expectedValue = undefined

    expect(asArray(input)).toEqual(expectedValue)
  })

  it('should be undefined', () => {
    const input = ''
    const expectedValue = undefined

    expect(asArray(input)).toEqual(expectedValue)
  })

  it('should be undefined', () => {
    const input: never[] = []
    const expectedValue = undefined

    expect(asArray(input)).toEqual(expectedValue)
  })

  it('should be an array', () => {
    const input = '/a/test/path'
    const expectedValue = [input]

    expect(asArray(input)).toEqual(expectedValue)
  })

  it('should be an array', () => {
    const input = ['/a/test/path']
    const expectedValue = input

    expect(asArray(input)).toEqual(expectedValue)
  })
})
