import type { Err } from '@nao-todo/types'

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

export function unwrapErrors(...errs: Err[]): string {
    const errStrings = errs.map((err) => unwrapError(err))
    return errStrings.join('; ')
}
