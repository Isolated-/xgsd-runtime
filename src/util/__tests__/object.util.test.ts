import {deepmerge2, mergeOn} from '../object.util'

/**
 *  mergeOn() tests
 *  @note used to merge block outputs into single object (typically)
 */
describe('mergeOn()', () => {
  test('should create a new object from objects in an array', () => {
    const items = [
      {
        data: {
          myData: true,
        },
      },
      {
        data: {
          anotherProperty: 1,
        },
      },
    ]

    expect(mergeOn('data', items)).toEqual({
      myData: true,
      anotherProperty: 1,
    })
  })

  test('should override data using last result', () => {
    const items = [
      {
        data: {
          myData: true,
        },
      },
      {
        data: {
          myData: false,
        },
      },
    ]

    expect(mergeOn('data', items)).toEqual({
      myData: false,
    })
  })

  test('objects without "property" dont cause failure', () => {
    const items = [{data: {myData: true}}, {}]
    expect(mergeOn('data', items)).toEqual({myData: true})
  })

  test('nested properties can be merged', () => {
    const data = {
      var: {myData: true},
    }

    const items = [{data}, {data}]
    expect(mergeOn('data', items)).toEqual({var: {myData: true}})
  })

  test("nested properties with the same key don't merge", () => {
    const data = {data: {data: {myData: true}}}
    const items = [{data}, {data}]
    expect(mergeOn('data', items)).toEqual({data: {data: {myData: true}}})
  })

  test('nested properties unwrap recursively level when unwrap = always', () => {
    const data = {data: {data: {myData: true}}}
    const items = [{data}, {data}]

    expect(mergeOn('data', items, {unwrap: 'always'})).toEqual({
      myData: true,
    })
  })

  test('nested properties unwrap one level when unwrap = auto and all items match', () => {
    const data = {data: {myData: true}}
    const items = [{data}, {data}]

    expect(mergeOn('data', items, {unwrap: 'auto'})).toEqual({
      data: {myData: true},
    })
  })

  test('auto does not unwrap when structure is inconsistent', () => {
    const items = [{data: {data: {myData: true}}}, {data: {myData: true}}]

    expect(mergeOn('data', items, {unwrap: 'auto'})).toEqual({
      data: {myData: true},
      myData: true,
    })
  })

  test('nested properties can be accessed and merged', () => {
    const data = {
      var: {myData: true},
    }

    const items = [{data}, {data}]
    expect(mergeOn('data.var', items)).toEqual({myData: true})
  })
})

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
