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

const myAtob = (input: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    const str = input.replace(/=+$/, '')
    let output = ''
    if (str.length % 4 === 1) {
        throw new Error('InvalidLengthError')
    }
    for (let i = 0, len = str.length; i < len; i += 4) {
        const a = chars.indexOf(str.charAt(i))
        const b = chars.indexOf(str.charAt(i + 1))
        const c = chars.indexOf(str.charAt(i + 2))
        const d = chars.indexOf(str.charAt(i + 3))
        const sum = (a << 18) | (b << 12) | (c << 6) | d
        output += String.fromCharCode((sum >> 16) & 0xff, (sum >> 8) & 0xff, sum & 0xff)
    }
    return output
}

export const getJWTPayload = (jwt: string) => {
    const jwtPayload = jwt.split('.')[1]
    const decodedPayload = JSON.parse(decodeURIComponent(myAtob(jwtPayload)))
    return decodedPayload as User
}

export function generateId(length: number = 6) {
    return Math.random()
        .toString(36)
        .slice(2, 2 + length);
}