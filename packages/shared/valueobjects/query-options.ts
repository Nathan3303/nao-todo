/**
 * 查询选项值对象
 * @description 用于存储查询选项的值对象，并提供转换为请求字符串的方法
 */
export class QueryOptionsValueObject {
    /**
     * 查询选项值对象
     * @description 用于存储查询选项的值对象
     * @param options 查询选项
     */
    constructor(public options: Record<string, unknown>) {}

    /**
     * 归一化每个查询选项值
     * @param value 查询选项值
     * @returns 归一化后的查询选项值
     */
    private normalizeEachHandler(value: unknown): string | void {
        // 1. 判断值是否为空
        if (value === void 0 || value === null || value === '') {
            return void 0
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
     * 转换为请求字符串
     * @param eachHandler 自定义处理每个查询选项值的函数
     * @returns 转换后的请求字符串
     */
    public toString(eachHandler?: (key: string, value: unknown) => string | void): string {
        const queryPairs: string[] = []
        // 1. 判断是否为空对象，为空则返回空字符串
        if (Object.keys(this.options).length === 0) return ''
        // 2. 遍历对象
        for (const key in this.options) {
            // 2.0 判断是否为原型链上的属性
            if (!Object.prototype.hasOwnProperty.call(this.options, key)) continue
            // 2.1 获取值
            const value = this.options[key]
            // console.log(key, value)
            // 2.2 判断值是否为空
            if (value === void 0 || value === null || value === '') continue
            // 2.3 判断是否有 eachHandler，如果有则交给 eachHandler 处理
            if (eachHandler) {
                const res = eachHandler(key, value)
                if (res !== void 0) {
                    queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(res)}`)
                    continue
                }
            }
            // 2.4 否则，使用默认处理函数
            const normalizedValue = this.normalizeEachHandler(value)
            if (normalizedValue === void 0) continue
            queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(normalizedValue)}`)
        }
        // 3. 拼接查询字符串并返回
        const queryString = queryPairs.join('&')
        // console.log(queryPairs, queryString)
        return queryString
    }
}