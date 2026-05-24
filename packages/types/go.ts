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

// 同步函数返回类型注意项：
// - Go<T, U> 表示函数返回值为 T，错误类型为 U。成功时返回 [T, null]，失败时返回 [null, U]
// - 由于必须处理错误的特性，因此即使是 Go<void> 也必须返回值，即使是 null（表示没有错误）
// - 最后处理错误时，当指定了返回值类型 T 时，必须判断错误类型 U 是否为 null，否则 T 会处于联合类型状态，导致类型断言失败。
//   因为错误类型必须处理，因此就算返回了值，但错误不为 null，也依旧应该被判断为失败。如：
//   ```
//   const [v, e] = fn() /* fn: () => Go<string> */
//   if (e) { /* error handle */ }
//   console.log(v) /* v: string | null */
//   if (e !== null) { /* error handle */ }
//   console.log(v) /* v: string */
//   ```
export type Go<T = unknown, U extends Err = Err> = T extends void
    ? GoWithoutValue
    : U extends null
      ? GoSuccess<Exclude<T, null>>
      : GoFailure<T, Exclude<U, null>>

// 异步函数返回类型（与同步函数返回类型相同）
export type GoAsync<T = unknown> = Promise<Go<T>>
