/**
 *  utility type that makes T a partial type with required keys K.
 *  @example
 *      type MainlyOptional<T, K extends keyof T> = Require<T, K>
 */
export type Require<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>
