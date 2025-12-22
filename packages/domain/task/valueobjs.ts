export type ListTaskOptionsValueObject = {
    projectId?: string
    tagId?: string
    name?: string
    state?: string
    priority?: string
    isDeleted?: boolean
    sort?: { field: string; order: 'asc' | 'desc' }
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month'
    page?: number
    limit?: number
}

export const parseObject2QueryString = <T>(
    options: T,
    eachHandler?: <U>(key: U, value: T[keyof T]) => string | undefined | null
): string => {
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
        if (valRaw === void 0 || valRaw === null || valRaw === '') {
            continue
        } else if (typeof valRaw === 'object') {
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
