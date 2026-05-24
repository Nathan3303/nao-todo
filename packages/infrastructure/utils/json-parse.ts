/**
 * 解析 JSON 字符串为对象
 * 函数返回值包含错误返回，调用时无需 try catch (依赖 Go Type)
 */

import type { Err, Go } from '@nao-todo/types'

export default (original: string): Go<object> => {
    try {
        // 空字符串返回空对象
        if (!original) return [{}, null]
        // 解析
        const parsed = JSON.parse(original)
        // 判断是否是空对象
        if (Object.keys(parsed).length === 0) {
            return [null, 'JSON 字符串为空对象']
        }
        // 正常返回
        return [parsed, null]
    } catch (err) {
        console.error('[JsonParser]', err)
        return [{}, err as Err]
    }
}
