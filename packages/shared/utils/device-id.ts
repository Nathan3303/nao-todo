/**
 * 设备 ID 协议
 * @description 客户端为「当前安装/浏览器」生成稳定随机 ID，用于把登录会话绑定到具体登录端。
 *              首次访问惰性生成并持久化；登出时不清除（同设备保持同一 ID，才能实现「同设备重复登录覆盖旧会话」）。
 */

const DEVICE_ID_KEY = 'nao.deviceId'

/**
 * 获取设备 ID
 * @description 优先读取 localStorage 已持久化的值；不存在则生成 UUID 并持久化后返回。
 *              crypto.randomUUID 仅在 secure context（HTTPS/localhost）可用，非安全上下文抛错时降级随机串，
 *              保证请求拦截器永不因设备 ID 生成失败而中断
 * @returns 设备 ID
 */
export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
        try {
            deviceId = crypto.randomUUID()
        } catch {
            // 非 secure context 降级：时间戳 + 随机串
            deviceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        }
        localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
}