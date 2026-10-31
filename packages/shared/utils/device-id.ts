/**
 * 设备 ID 协议
 * @description 客户端为「当前安装/浏览器」生成稳定随机 ID，用于把登录会话绑定到具体登录端。
 *              首次访问惰性生成并持久化；登出时不清除（同设备保持同一 ID，才能实现「同设备重复登录覆盖旧会话」）。
 *
 *              **存储受限降级（DEF-96 / ADR D7）**：隐私模式 / 配额耗尽时 `localStorage` 读写会抛错，
 *              而本函数被请求拦截器**无条件调用** ⇒ 必须永不抛错（否则连登录都失败）：
 *              读失败 ⇒ 当作无缓存；写失败 ⇒ 仅本进程内缓存，**不阻塞请求**；降级留结构化日志。
 */

const DEVICE_ID_KEY = 'nao.deviceId'

/** 进程内降级缓存（存储不可用时保证同一次运行内 ID 稳定） */
let cachedDeviceId: string | null = null

/** 生成设备 ID（crypto.randomUUID 非安全上下文不可用 ⇒ 时间戳 + 随机串兜底） */
const generateDeviceId = (): string => {
    try {
        return crypto.randomUUID()
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    }
}

/**
 * 获取设备 ID
 * @description 优先进程内缓存 → `localStorage` 已持久化的值 → 新生成并尝试持久化。
 *              任何存储异常都降级为进程内缓存，**不抛错**（AC9：登录不失败）。
 * @returns 设备 ID（非空）
 */
export const getDeviceId = (): string => {
    if (cachedDeviceId) return cachedDeviceId
    let stored: string | null = null
    try {
        stored = localStorage.getItem(DEVICE_ID_KEY)
    } catch (readError) {
        console.warn('[device-id] 读取 localStorage 失败，降级为进程内设备 ID', {
            event: 'device.id.storage-unavailable',
            phase: 'read',
            reason: readError instanceof Error ? readError.name : typeof readError
        })
    }
    if (stored) {
        cachedDeviceId = stored
        return stored
    }
    const generated = generateDeviceId()
    try {
        localStorage.setItem(DEVICE_ID_KEY, generated)
    } catch (writeError) {
        console.warn('[device-id] 写入 localStorage 失败，降级为进程内设备 ID', {
            event: 'device.id.storage-unavailable',
            phase: 'write',
            reason: writeError instanceof Error ? writeError.name : typeof writeError
        })
    }
    cachedDeviceId = generated
    return generated
}