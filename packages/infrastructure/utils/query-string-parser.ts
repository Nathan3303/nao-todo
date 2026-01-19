/**
 * 解析查询字符串中的每个值
 * @param value 查询字符串中的值
 * @returns 解析后的字符串
 */
const __normalizeEachHandler = (value: unknown): string | undefined => {
    // 1. 判断值是否为空
    if (value === void 0 || value === null || value === '') {
        return
    }
    // 2. 判断值是否为对象
    if (typeof value === 'object') {
        return JSON.stringify(value)
    }
    // 3. 判断值是否为数组
    if (Array.isArray(value)) {
        return (value as unknown[]).join(',')
    }
    // 4. 其他情况，直接转换为字符串
    return value as string
}

/**
 * 解析对象为查询字符串
 * @param options 对象
 * @param eachHandler 每个值的处理函数
 * @returns 查询字符串
 */
export default <T extends Record<string, unknown>>(
    options: T,
    eachHandler?: <K extends keyof T>(key: K, value: T[K]) => string | undefined | void
): string => {
    const queryPairs: string[] = []
    // 1. 判断是否为空对象
    if (Object.keys(options).length === 0) return ''
    // 2. 遍历对象
    for (const key in options) {
        // 2.0 判断是否为原型链上的属性
        if (!Object.prototype.hasOwnProperty.call(options, key)) continue
        // 2.1 获取值
        const value = options[key]
        // 2.2 判断值是否为空
        if (value === undefined || value === null || value === '') continue
        // 2.3 判断是否有 eachHandler，如果有则交给 eachHandler 处理
        if (eachHandler) {
            const res = eachHandler(key, value)
            if (res !== undefined) {
                queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(res)}`)
                continue
            }
        }
        // 2.4 否则，使用默认处理函数
        const normalizedValue = __normalizeEachHandler(value)
        if (normalizedValue === undefined) continue
        queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(normalizedValue)}`)
    }
    // 3. 拼接查询字符串并返回
    return queryPairs.join('&')
}
