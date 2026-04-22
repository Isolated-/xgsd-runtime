import {deepmerge2} from '../object.util'

/**
 *  deepmerge() tests
 *  @note replaces lodash.merge
 */
describe('deepmerge()', () => {
  describe('when merging two objects', () => {
    test('should deeply merge the objects', () => {
      const obj1 = {a: 1, b: {c: 2}}
      const obj2 = {b: {d: 3}, e: 4}
      const result = deepmerge2(obj1, obj2)
      expect(result).toEqual({a: 1, b: {c: 2, d: 3}, e: 4})
    })

    test('should not mutate the original objects', () => {
      const obj1 = {a: 1, b: {c: 2}}
      const obj2 = {b: {d: 3}, e: 4}
      const obj1Copy = JSON.parse(JSON.stringify(obj1))
      const obj2Copy = JSON.parse(JSON.stringify(obj2))
      deepmerge2(obj1, obj2)
      expect(obj1).toEqual(obj1Copy)
      expect(obj2).toEqual(obj2Copy)
    })

    test('should gracefully handle undefined', () => {
      const obj1 = undefined
      const obj2 = undefined

      const result = deepmerge2(obj1, obj2)
      expect(result).toEqual({})
    })
  })
})
