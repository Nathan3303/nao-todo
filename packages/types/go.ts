/**
 * 函数错误处理类型
 * 借鉴 Golang 错误处理方式，有错误优先处理错误
 */
export type WithNull<T> = T | null
export type Err = WithNull<Error | string | Error[] | string[]>

export type GoLike<T = unknown> = [T, Err]
export type GoLikeAsync<T = unknown> = Promise<[T, Err]>

export type GoSuccess<T> = [T, null]
export type GoFailure<T, U> = [WithNull<T>, U]
export type GoWithoutValue = Err
export type Go<T = unknown, U extends Err = Err> = T extends undefined | void
    ? GoWithoutValue
    : U extends null
      ? GoSuccess<Exclude<T, null>>
      : GoFailure<T, Exclude<U, null>>

export type GoAsync<T = unknown> = Promise<Go<T>>
