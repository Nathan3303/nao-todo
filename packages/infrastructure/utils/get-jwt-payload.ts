import type { User } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

/**
 * 获取JWT Payload
 * @param jwt JWT字符串
 * @returns JWT Payload
 */
const getJwtPayload = (jwt: string) => {
    // 拆分 JWT
    const parts = jwt.split('.')
    if (parts.length != 3) {
        console.error('Invalid JWT parts for JWT')
        return {}
    }
    const payloadPart = parts[1] || ''

    // 将 Base64Url 转换为标准 Base64
    let base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')

    // 3. 补齐填充 '='
    while (base64.length % 4) base64 += '='

    // 4. 解码并解析 JSON
    try {
        const decoded = atob(base64)
        const payload = JSON.parse(decoded)
        return payload.profile as User
    } catch (e) {
        throw new Error('Failed to decode or parse payload: ' + unwrapError(e as string | Error))
    }
}

export default getJwtPayload

