import type { User } from '@nao-todo/types'

// throttle
export const throttle = (callback: (...args: any[]) => void | Promise<any>, delay: number) => {
    let timer: number | null = null
    return async (...args: any[]) => {
        if (timer) return;
        const result = await callback(...args)
        timer = setTimeout(() => (timer = null), delay) as unknown as number
        return result
    }

};

export const debounce = (callback: (...args: any) => void | Promise<any>, delay: number) => {
    let timer: number | null = null
    return (...args: any[]) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            callback(...args)
            timer = null
        }, delay) as unknown as number
    }
}

export const stringifyGetOptions = <T>(
    options: T,
    eachHandler?: <U>(key: U, value: T[keyof T]) => string | undefined | null
) => {
    const queryPairs: string[] = []
    for (const key in options) {
        if (eachHandler) {
            const handleResult = eachHandler(key, options[key])
            if (typeof handleResult === 'string') {
                queryPairs.push(handleResult)
                continue
            } else if (handleResult === null) {
                continue
            }
        }
        const valRaw = options[key as keyof T]
        let val: string = ''
        if (typeof valRaw === 'object') {
            val = JSON.stringify(valRaw)
        } else if (Array.isArray(valRaw)) {
            val = (valRaw as unknown[]).join(',')
        } else {
            val = valRaw as string
        }
        queryPairs.push(`${key}=${val}`)
    }
    return queryPairs.join('&')
}

export const getJWTPayload = (jwt: string) => {
    const jwtPayload = jwt.split('.')[1]
    const decodedPayload = JSON.parse(decodeURIComponent(atob(jwtPayload)))
    return decodedPayload as User
}

export function generateId(length: number = 6) {
    return Math.random()
        .toString(36)
        .slice(2, 2 + length);
}