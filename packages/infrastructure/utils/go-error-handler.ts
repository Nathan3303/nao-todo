import type { Err } from '@nao-todo/types'

/**
 * 解析错误信息
 * @param err 错误对象
 * @returns 错误信息字符串
 */
export function unwrapError(err: Err): string {
    let errString = ''
    if (Array.isArray(err)) {
        err.forEach((_err: Error | string, idx) => {
            errString += unwrapError(_err)
            if (idx !== err.length - 1) errString += '; '
        })
    } else if (err instanceof Error) {
        errString = err.message
    } else {
        errString = err ?? 'noError'
    }
    return errString
}

/**
 * 解析多个错误信息
 * @param errs 错误对象数组
 * @returns 错误信息字符串
 */
export function unwrapErrors(...errs: Err[]): string {
    const errStrings = errs.map((err) => unwrapError(err))
    return errStrings.join('; ')
}

