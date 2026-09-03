/**
 * 雪花 ID 生成器（与后端同格式）
 * @description 63bit：41bit 时间戳段（ms − epoch） + 10bit 机器位 + 12bit 序列；
 *              产出数字字符串（超出 Number.MAX_SAFE_INTEGER，按字符串处理，见 data-sync-plan.md §1.4）。
 *              机器位取设备级持久随机数 ∈ [2, 1023]，避开后端固定 machineID=1，
 *              避免同毫秒同机器位跨端碰撞。
 */
import { getOrCreateMachineId, getSnowflakeEpoch } from './sync-config'

const MACHINE_BITS = 10n
const SEQUENCE_BITS = 12n
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n // 4095
const SHIFT = MACHINE_BITS + SEQUENCE_BITS

export class SnowflakeGenerator {
    private epoch: number
    private machineId: number
    private sequence = 0n
    private lastTimestamp = -1n

    constructor(epoch = getSnowflakeEpoch(), machineId = getOrCreateMachineId()) {
        this.epoch = epoch
        this.machineId = machineId
    }

    /** 重新配置（登录后拉取到后端 snowflakeEpoch 时调用） */
    configure(epoch?: number, machineId?: number): void {
        if (epoch !== undefined) this.epoch = epoch
        if (machineId !== undefined) this.machineId = machineId
    }

    /** 生成下一个雪花 ID（数字字符串） */
    nextId(): string {
        let timestamp = BigInt(Date.now()) - BigInt(this.epoch)
        // epoch 未对齐（如时钟回拨到 epoch 前）时取 0，仍保证同进程内唯一
        if (timestamp < 0n) timestamp = 0n

        if (timestamp < this.lastTimestamp) {
            // 时钟回拨：等待时钟追平并超过 lastTimestamp，避免复用已生成过的毫秒段
            // （同毫秒段同序列会产出重复 ID，见审查报告缺陷 4）
            while (timestamp <= this.lastTimestamp) {
                timestamp = BigInt(Date.now()) - BigInt(this.epoch)
                if (timestamp < 0n) timestamp = 0n
            }
            this.sequence = 0n
        } else if (timestamp > this.lastTimestamp) {
            this.sequence = 0n
        } else {
            // 同毫秒：序列递增；序列回绕（4095 → 0）时等待下一毫秒
            this.sequence = (this.sequence + 1n) & MAX_SEQUENCE
            if (this.sequence === 0n) {
                while (timestamp <= this.lastTimestamp) {
                    timestamp = BigInt(Date.now()) - BigInt(this.epoch)
                    if (timestamp < 0n) timestamp = 0n
                }
                this.sequence = 0n
            }
        }
        this.lastTimestamp = timestamp
        const id = (timestamp << SHIFT) | (BigInt(this.machineId) << SEQUENCE_BITS) | this.sequence
        return id.toString()
    }
}

/** 全局单例（Epoch 由登录后的 initSnowflakeEpoch 配置） */
export const snowflake = new SnowflakeGenerator()