import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { SnowflakeGenerator } from '../snowflake'
import {
    DEFAULT_SNOWFLAKE_EPOCH,
    getSnowflakeEpoch,
    getOrCreateMachineId,
    MACHINE_ID_MAX,
    MACHINE_ID_MIN
} from '../sync-config'

/**
 * 雪花 ID 生成器测试
 * @description 唯一性、单调递增、数字字符串格式、epoch 偏移、机器位隔离
 */
describe('SnowflakeGenerator', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('连续生成 10000 个 id 全部唯一', () => {
        const generator = new SnowflakeGenerator()
        const ids = new Set<string>()
        for (let i = 0; i < 10000; i++) {
            const id = generator.nextId()
            expect(ids.has(id)).toBe(false)
            ids.add(id)
        }
    })

    it('连续生成的 id 单调递增', () => {
        const generator = new SnowflakeGenerator()
        let prev = 0n
        for (let i = 0; i < 10000; i++) {
            const id = BigInt(generator.nextId())
            expect(id > prev).toBe(true)
            prev = id
        }
    })

    it('产出为数字字符串（雪花格式，超出 Number.MAX_SAFE_INTEGER）', () => {
        const generator = new SnowflakeGenerator()
        const id = generator.nextId()
        expect(typeof id).toBe('string')
        expect(/^\d+$/.test(id)).toBe(true)
        expect(Number.isSafeInteger(Number(id))).toBe(false)
    })

    it('epoch 偏移：id 时间戳段 = 实际时间 − epoch', () => {
        const epoch = 1677628800000 // 2023-03-01T00:00:00Z
        const generator = new SnowflakeGenerator(epoch, 2)
        const id = BigInt(generator.nextId())
        const timestamp = id >> 22n // 41bit 时间戳段
        const elapsed = BigInt(Date.now()) - BigInt(epoch)
        // 允许 1ms 内误差（同毫秒生成）
        expect(timestamp <= elapsed).toBe(true)
        expect(elapsed - timestamp <= 1n).toBe(true)
    })

    it('configure 可重置 epoch（登录后拉取到后端值时）', () => {
        const generator = new SnowflakeGenerator(DEFAULT_SNOWFLAKE_EPOCH, 2)
        const before = generator.nextId()
        generator.configure(0)
        const after = generator.nextId()
        // epoch=0 后时间戳段显著增大（id 更大），且仍唯一
        expect(BigInt(after) > BigInt(before)).toBe(true)
    })

    it('不同机器位生成器互不碰撞（同毫秒同序列不同机器位）', () => {
        const machineA = new SnowflakeGenerator(DEFAULT_SNOWFLAKE_EPOCH, 2)
        const machineB = new SnowflakeGenerator(DEFAULT_SNOWFLAKE_EPOCH, 3)
        const ids = new Set<string>()
        for (let i = 0; i < 10000; i++) {
            const idA = machineA.nextId()
            const idB = machineB.nextId()
            expect(ids.has(idA)).toBe(false)
            expect(ids.has(idB)).toBe(false)
            ids.add(idA)
            ids.add(idB)
        }
    })

    it('时钟回拨后等待时钟追平，不生成重复 ID', () => {
        const realNow = Date.now
        let clock = realNow()
        let stepping = false
        const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
            // 回拨后每次读取时间 +1ms（模拟时钟缓慢恢复，避免等待循环死锁）
            if (stepping) clock += 1
            return clock
        })
        try {
            const generator = new SnowflakeGenerator(DEFAULT_SNOWFLAKE_EPOCH, 2)
            const ids = new Set<string>()
            for (let i = 0; i < 50; i++) ids.add(generator.nextId())
            // 时钟回拨 100ms，之后缓慢恢复
            clock -= 100
            stepping = true
            for (let i = 0; i < 200; i++) {
                const id = generator.nextId()
                expect(ids.has(id)).toBe(false)
                ids.add(id)
            }
            expect(ids.size).toBe(250)
        } finally {
            spy.mockRestore()
        }
    })
})

/**
 * 同步配置访问点测试
 */
describe('SyncConfig', () => {
    it('默认 epoch 与后端常量一致（2023-03-01T00:00:00Z）', () => {
        expect(DEFAULT_SNOWFLAKE_EPOCH).toBe(1677628800000)
        expect(getSnowflakeEpoch()).toBe(DEFAULT_SNOWFLAKE_EPOCH)
    })

    it('机器位落在 [2, 1023] 区间（避开后端 machineID=1）', () => {
        for (let i = 0; i < 100; i++) {
            const id = getOrCreateMachineId()
            expect(id).toBeGreaterThanOrEqual(MACHINE_ID_MIN)
            expect(id).toBeLessThanOrEqual(MACHINE_ID_MAX)
            expect(id).not.toBe(1)
        }
    })
})