/**
 * 去重账本（持久，T527 / AC3 · AC4 · AC6）
 * @description 键 = `taskId@remindAt`（R2 单一去重键）。`claim` **同步 / 幂等 / 原子**：
 *              首次抢到返回 true，其后一律 false（同实例 / 刷新 / 重开 / 另开标签）。
 *              storage 不可用（缺省 / 抛错 / 配额满）⇒ **退化为内存账本**，不抛错
 *              （唯一性降级为「同标签内一次」，见 PRD §六可用性，登记为已知限制）。
 */
import type { ReminderLedger } from './types'

/** localStorage 键（同源跨标签共享） */
const CLAIMS_STORAGE_KEY = 'nao-todo:reminder-claims'

/**
 * 账本裁剪上限
 * @description 已消费的键不再对应存活条目（一次性提醒清空 `remindAt`、重复提醒推进下一次）
 *              ⇒ 裁剪旧键不会导致同键复弹（PRD §六可维护性）。
 */
const MAX_CLAIMS = 500

/** 只依赖用到的方法，便于注入 `Storage` 形状的假存储 */
export type ClaimLedgerStorage = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export type CreateClaimLedgerOptions = {
    storage?: ClaimLedgerStorage | null
}

/**
 * 创建去重账本
 * @param options.storage 持久存储（缺省 / 不可用 ⇒ 内存账本）
 */
export const createClaimLedger = ({ storage }: CreateClaimLedgerOptions = {}): ReminderLedger => {
    /** 本标签内存视图（保证 sync 幂等；也是存储降级时的唯一判据） */
    const memory = new Set<string>()
    /** 一旦读写抛错（隐私模式 / 配额满）⇒ 本次会话内不再尝试，避免重复异常开销 */
    let storageBroken = false

    const readPersisted = (): string[] => {
        if (!storage || storageBroken) return []
        try {
            const raw = storage.getItem(CLAIMS_STORAGE_KEY)
            if (!raw) return []
            const parsed: unknown = JSON.parse(raw)
            return Array.isArray(parsed)
                ? parsed.filter((key): key is string => typeof key === 'string')
                : []
        } catch {
            storageBroken = true
            return []
        }
    }

    const writePersisted = (keys: readonly string[]): void => {
        if (!storage || storageBroken) return
        try {
            storage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(keys.slice(-MAX_CLAIMS)))
        } catch {
            storageBroken = true
        }
    }

    const has = (key: string): boolean => memory.has(key) || readPersisted().includes(key)

    const claim = (key: string): boolean => {
        if (memory.has(key)) return false
        const persisted = readPersisted()
        if (persisted.includes(key)) {
            memory.add(key)
            return false
        }
        // 内存先行：存储写失败时同标签内仍保持唯一（AC6 降级口径）
        memory.add(key)
        writePersisted([...persisted.filter((item) => item !== key), key])
        return true
    }

    return { claim, has }
}