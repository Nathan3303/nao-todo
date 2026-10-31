// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T589 红基线 —— AC9 存储能力降级（`DEF-96`，ADR D7）
 *
 * 缺陷现场：`getDeviceId()` 直接 `localStorage.getItem/setItem`，隐私模式/配额异常会抛错；
 * 而它被 axios 请求拦截器**无条件调用** ⇒ **连登录都失败**。
 *
 * 判据（PM 裁定 ④：可见口径 = 结构化日志，**不弹 UI**）：
 * - `localStorage` 读或写抛错 ⇒ `getDeviceId()` **不抛**、返回非空值；
 * - 同一进程内**稳定**（第二次调用同值，无需落盘）；
 * - 降级必须留**结构化日志**痕迹（`console` 信封里能读到 device 相关事件）。
 *
 * 状态：**红**（`getItem/setItem` 无 `try/catch`、无进程内缓存）。
 * 变异易感：去掉 `try/catch` ⇒ 抛错 ⇒ 红；去掉日志 ⇒ 红。
 */

const loadGetDeviceId = async (): Promise<(() => string) | null> => {
    vi.resetModules()
    try {
        const mod = (await import('../device-id')) as { getDeviceId?: () => string }
        return mod.getDeviceId ?? null
    } catch {
        return null
    }
}

/** 收集 console 三个级别的输出（structured-log 走 console 信封） */
const spyConsole = (): string[] => {
    const lines: string[] = []
    const record = (...args: unknown[]) => {
        lines.push(args.map((arg) => String(arg)).join(' '))
    }
    vi.spyOn(console, 'warn').mockImplementation(record)
    vi.spyOn(console, 'log').mockImplementation(record)
    vi.spyOn(console, 'error').mockImplementation(record)
    return lines
}

const denyStorage = (): void => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: localStorage is disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError: localStorage is full')
    })
}

beforeEach(() => {
    localStorage.clear()
})

afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
})

describe('AC9：localStorage 不可用 ⇒ 设备 ID 降级不抛错', () => {
    it('读写均抛错 ⇒ 返回值非空、进程内稳定', async () => {
        const getDeviceId = await loadGetDeviceId()
        expect(getDeviceId, '缺实现：packages/shared/utils/device-id.ts').not.toBeNull()
        denyStorage()

        const first = getDeviceId!()
        const second = getDeviceId!()

        expect(typeof first).toBe('string')
        expect(first.length).toBeGreaterThan(8)
        expect(second).toBe(first)
    })

    it('降级有结构化日志痕迹（可见口径 = 日志，不弹 UI）', async () => {
        const lines = spyConsole()
        const getDeviceId = await loadGetDeviceId()
        expect(getDeviceId).not.toBeNull()
        denyStorage()

        getDeviceId!()

        const visible = lines.some((line) => /device/i.test(line))
        expect(visible, `实际日志：${lines.join(' | ') || '（无输出）'}`).toBe(true)
    })

    it('仅读抛错（写可用）⇒ 仍不抛错', async () => {
        const getDeviceId = await loadGetDeviceId()
        expect(getDeviceId).not.toBeNull()
        spyConsole()
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })

        expect(() => getDeviceId!()).not.toThrow()
        expect(getDeviceId!().length).toBeGreaterThan(0)
    })
})

describe('AC9 回归护栏：正常环境行为不变', () => {
    it('首次生成并持久化，后续读回同值', async () => {
        const getDeviceId = await loadGetDeviceId()
        expect(getDeviceId).not.toBeNull()

        const first = getDeviceId!()
        vi.resetModules()
        const reloaded = (await import('../device-id')) as { getDeviceId: () => string }

        expect(reloaded.getDeviceId()).toBe(first)
        expect(localStorage.getItem('nao.deviceId')).toBe(first)
    })
})