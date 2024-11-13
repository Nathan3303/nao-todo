import type { User } from '@nao-todo/types'

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
    eachHandler?: (key: string, value: unknown) => string
) => {
    const queryPairs: string[] = []
    for (const key in options) {
        if (!eachHandler) {
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
            continue
        }
        const handleResult = eachHandler(key, options[key as keyof T])
        if (handleResult) {
            queryPairs.push(handleResult)
        }
    }
    return queryPairs.join('&')
}

export const getJWTPayload = (jwt: string) => {
    const jwtPayload = jwt.split('.')[1]
    const decodedPayload = JSON.parse(atob(jwtPayload))
    return decodedPayload as User
}
