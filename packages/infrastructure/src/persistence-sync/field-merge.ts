/**
 * 字段级三方合并内核（B 批 M2 / `T677`）
 *
 * @description **纯函数**：无 IO / 无 Dexie / **同步（非 async）** ⇒ 可 100% 单测 + 变异。
 *              输入 = 字段级基准 `B`（`fieldBase`，只含「我改过的字段」）× 云端当前 `R` × 本地当前 `L`
 *              × 合并域键集（= `entityToPush` 键集 − 忽略集；⛔ 本模块**不造第四张字段表**）。
 *
 *              判定（PRD `R-2`）：`R==B ⇒ L` · `L==B ⇒ R` · `R==L ⇒ 取其一` ·
 *              **三者两两不等 ⇒ 冲突**。比较**一律** `valuesEqual`（空哨兵归一；
 *              ⛔ 不新增第二套比较语义、不扩口径）。
 *
 *              **基准缺失 ⇒ 保守**（ADR D1）：该字段 `R≠L` 即视为冲突（不凭猜测合并）。
 *
 *              冲突字段的取值 = `lwwWinner`（默认 `local`）：内核只做纯计算，
 *              边界（pull 远端胜 / pull 本地胜 / push `stale`）按各自**既有裁决**传 winner 覆盖
 *              —— 见 ADR D5 记账表（接入在 M3/M4，本模块不感知边界）。
 *
 * @see docs/adr/2026-11-10-field-level-merge.md（决策 3/4/5 · D4 字段规则 · D7 回滚）
 * @see docs/reports/T672-field-merge-arch-review.md（§三 D4/D5）
 * @see docs/prds/2026-11-09-field-level-merge.md（R-1…R-4 / AC1–AC6）
 */

import { isAbsentStamp } from '../persistence-local/utils'
import { valuesEqual } from './conflict-journal'
import { SYNC_COMPARE_IGNORED_FIELDS } from './sync-normalize'

/** 合并模式：`merge` = 字段级三方；`lww` = 整行赢家退化（同一函数，⛔ 不是第二套算法） */
export type MergeMode = 'merge' | 'lww'

/** 回滚开关的存储键（ADR D7 固定；`merge` 默认 / `lww` 一键降级） */
export const FIELD_MERGE_MODE_KEY = 'nao-todo:field-merge-mode'

/**
 * 解析当前合并模式（ADR D7：开关读取点**唯一**）
 * @description `localStorage['nao-todo:field-merge-mode'] === 'lww'` ⇒ 降级；其余（含无 localStorage /
 *              读失败 / 非法值）⇒ `merge`。⛔ 不要在调用点另读 localStorage。
 */
export const resolveMergeMode = (): MergeMode => {
    try {
        if (typeof localStorage === 'undefined') return 'merge'
        return localStorage.getItem(FIELD_MERGE_MODE_KEY) === 'lww' ? 'lww' : 'merge'
    } catch {
        return 'merge'
    }
}

/** `lww` 模式的整行赢家（仅 `mode='lww'` 读取；`merge` 模式只决定冲突字段取值） */
export type MergeWinner = 'local' | 'remote'

/**
 * 字段组：组内**原子**裁决（ADR D4）
 * @description 提醒四字段语义耦合 —— 逐字段合并会产出「我的时刻 + 对方的重复规则」这类非法组合。
 *              ⛔ 不要为单个字段单独接线：判定与取值都必须走组。
 */
export const FIELD_GROUPS: readonly (readonly string[])[] = [
    ['remindAt', 'remindRepeat', 'remindTime', 'remindWeekdays']
]

/**
 * 服务端 owned 的派生计数：本地不可写 ⇒ 恒取 `R`（不进冲突判定）
 * @description 这些字段不在 `entityToPush` 键集内（合并域天然排除），此处为**防御性**处理：
 *              若调用方误把它们放进 `fields`，也不得用本地值覆盖服务端派生值。
 */
export const SERVER_OWNED_FIELDS: ReadonlySet<string> = new Set([
    'checkItemCount',
    'commentCount',
    'subtaskCount'
])

/** 墓碑字段：整行裁决（R-4），**不进合并域**（即使被放进 `fields` 也跳过） */
const TOMBSTONE_FIELD = 'deletedAt'

/**
 * 队列内部字段：只在本地队列内流转，⛔ 不得出现在合并结果 / 推送载荷
 * @description 防御性剔除（调用方误传 `fieldBase` 时也不得污染 `merged`）。
 */
const QUEUE_ONLY_FIELDS: ReadonlySet<string> = new Set(['fieldBase'])

/** 排序值字段：本地 `0` = 未设置（与 `buildTaskPush` 的「0 不发送」同口径）⇒ 取 `R` */
const SORT_FIELD = 'sortId'

export interface FieldMergeInput {
    /** 字段级基准 `B`（`fieldBase`）；缺省 ⇒ 全部字段按「无基准 ⇒ 保守」处理 */
    base?: Record<string, unknown>
    /** 云端当前 `R` */
    remote: Record<string, unknown>
    /** 本地当前 `L` */
    local: Record<string, unknown>
    /**
     * 合并域（= `entityToPush` 键集 − 忽略集）
     * @description 缺省 ⇒ `local ∪ remote ∪ base` 的键集（仍会剔除忽略集与墓碑）。
     */
    fields?: readonly string[]
    /** 默认 `merge` */
    mode?: MergeMode
    /** 冲突字段 / `lww` 整行取值方向；默认 `local` */
    lwwWinner?: MergeWinner
}

export interface FieldMergeResult {
    /** 合并结果（**只含合并域字段**；不含 `fieldBase` / 任何同步元数据） */
    merged: Record<string, unknown>
    /** 冲突字段（按 `fields` 顺序，确定性；空数组 = 全部自动合并成功） */
    conflicts: string[]
}

const hasOwn = (record: Record<string, unknown>, field: string): boolean =>
    Object.prototype.hasOwnProperty.call(record, field)

/** 合并域剔除：同步元数据（单一来源）+ 队列内部字段 + 墓碑 */
const isExcludedField = (field: string): boolean =>
    SYNC_COMPARE_IGNORED_FIELDS.has(field) ||
    QUEUE_ONLY_FIELDS.has(field) ||
    field === TOMBSTONE_FIELD

const resolveFields = (input: FieldMergeInput): string[] => {
    if (input.fields) return [...new Set(input.fields)]
    const union = new Set<string>()
    for (const record of [input.local, input.remote, input.base]) {
        if (!record) continue
        for (const field of Object.keys(record)) union.add(field)
    }
    return [...union]
}

const groupOf = (field: string): readonly string[] | undefined =>
    FIELD_GROUPS.find((group) => group.includes(field))

interface Decision {
    value: unknown
    conflict: boolean
}

/**
 * 标量 / 枚举 / 布尔 / 时间 / 引用的三方判定（R-2）
 * @description 基准缺失（整份缺省或该字段不在基准里）⇒ `R≠L` 即冲突（保守，不猜测合并）。
 */
const decideScalar = (
    base: Record<string, unknown> | undefined,
    remote: Record<string, unknown>,
    local: Record<string, unknown>,
    field: string,
    winner: MergeWinner
): Decision => {
    const remoteValue = remote[field]
    const localValue = local[field]
    // R==L ⇒ 取其一（本地形状优先，避免无意义写）
    if (valuesEqual(remoteValue, localValue)) return { value: localValue, conflict: false }
    // 无基准 ⇒ 保守冲突
    if (!base || !hasOwn(base, field)) {
        return { value: winner === 'remote' ? remoteValue : localValue, conflict: true }
    }
    const baseValue = base[field]
    if (valuesEqual(remoteValue, baseValue)) return { value: localValue, conflict: false } // R==B ⇒ L
    if (valuesEqual(localValue, baseValue)) return { value: remoteValue, conflict: false } // L==B ⇒ R
    return { value: winner === 'remote' ? remoteValue : localValue, conflict: true } // 三者两两不等
}

const toTagList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * 集合（`tags`）逐元素存在性三方 + 并集不丢（ADR D4 / AC2）
 * @description 结果 =（我的集合 ∪ 对方集合）− 我删的 − 对方删的；按值去重；
 *              顺序 = 我的相对顺序在前，对方**新增**项按对方顺序追加（确定性 ⇒ 幂等）。
 *              元素级「删除」按存在性判定，不做元素级冲突（并集恒有定义）。
 */
const decideTags = (
    base: Record<string, unknown> | undefined,
    remote: Record<string, unknown>,
    local: Record<string, unknown>,
    winner: MergeWinner
): Decision => {
    const remoteTags = toTagList(remote.tags)
    const localTags = toTagList(local.tags)
    if (valuesEqual(remoteTags, localTags)) return { value: localTags, conflict: false }
    if (!base || !hasOwn(base, 'tags')) {
        return {
            value: winner === 'remote' ? remoteTags : localTags,
            conflict: true
        }
    }
    const baseTags = toTagList(base.tags)
    const remoteSet = new Set(remoteTags.map((tag) => String(tag)))
    const localSet = new Set(localTags.map((tag) => String(tag)))
    // 两侧各自的「删除集」：基准里有、本侧已无 ⇒ 该元素被本侧删除（删除不复活）
    const deleted = new Set<string>()
    for (const tag of baseTags) {
        const key = String(tag)
        if (!localSet.has(key) || !remoteSet.has(key)) deleted.add(key)
    }
    const merged: unknown[] = []
    const seen = new Set<string>()
    for (const tag of [...localTags, ...remoteTags]) {
        const key = String(tag)
        if (deleted.has(key) || seen.has(key)) continue
        seen.add(key)
        merged.push(tag)
    }
    return { value: merged, conflict: false }
}

/**
 * `archivedAt`：归档优先，但其它字段继续合并（AC6 / R-4 的软状态侧）
 * @description 任一侧非空且另一侧为空 ⇒ 取非空（归档胜）；两侧同为空 / 同非空 ⇒ 按三方。
 */
const decideArchivedAt = (
    base: Record<string, unknown> | undefined,
    remote: Record<string, unknown>,
    local: Record<string, unknown>,
    winner: MergeWinner
): Decision => {
    const remoteValue = remote.archivedAt as string | null | undefined
    const localValue = local.archivedAt as string | null | undefined
    const remoteAbsent = isAbsentStamp(remoteValue)
    const localAbsent = isAbsentStamp(localValue)
    if (remoteAbsent !== localAbsent) {
        return { value: remoteAbsent ? localValue : remoteValue, conflict: false }
    }
    return decideScalar(base, remote, local, 'archivedAt', winner)
}

/**
 * 提醒组原子裁决（ADR D4 / AC15）
 * @description **组内两侧都改 ⇒ 整组冲突**（不论改的是不是同一字段 —— 分别改 `remindRepeat` /
 *              `remindWeekdays` 同样会产生非法组合），整组取 winner（⛔ 不得混搭）；
 *              仅一侧改 ⇒ 整组取该侧；都未改 / 两侧改成同值 ⇒ 整组取 `R`。
 */
const decideGroup = (
    base: Record<string, unknown> | undefined,
    remote: Record<string, unknown>,
    local: Record<string, unknown>,
    fields: readonly string[],
    winner: MergeWinner
): { values: Record<string, unknown>; conflict: boolean } => {
    const changedBy = (side: Record<string, unknown>, field: string): boolean =>
        !base || !hasOwn(base, field) || !valuesEqual(side[field], base[field])
    const remoteChanged = fields.some((field) => changedBy(remote, field))
    const localChanged = fields.some((field) => changedBy(local, field))
    const pick = (side: Record<string, unknown>): Record<string, unknown> => {
        const values: Record<string, unknown> = {}
        for (const field of fields) values[field] = side[field]
        return values
    }
    if (localChanged && remoteChanged) {
        // 两侧都改：值相同 ⇒ 视为无差异（取 R）；不同 ⇒ 整组冲突（不逐字段拼装）
        const same = fields.every((field) => valuesEqual(remote[field], local[field]))
        if (same) return { values: pick(remote), conflict: false }
        return { values: pick(winner === 'remote' ? remote : local), conflict: true }
    }
    if (localChanged) return { values: pick(local), conflict: false }
    if (remoteChanged) return { values: pick(remote), conflict: false }
    return { values: pick(remote), conflict: false }
}

/**
 * 字段级三方合并
 * @param input 基准 / 云端 / 本地 / 合并域 / 模式
 * @returns `merged`（只含合并域字段）+ `conflicts`（按 `fields` 顺序）
 */
export const mergeBusinessFields = (input: FieldMergeInput): FieldMergeResult => {
    const { base, remote, local, mode = 'merge', lwwWinner = 'local' } = input
    const fields = resolveFields(input)
    const merged: Record<string, unknown> = {}
    const conflicts = new Set<string>()

    // 回滚开关的**同一函数**退化：`lww` = 整行赢家（不读 base、不做字段判定、无字段级信号）
    if (mode === 'lww') {
        const winnerRecord = lwwWinner === 'remote' ? remote : local
        for (const field of fields) {
            if (isExcludedField(field)) continue
            merged[field] = winnerRecord[field]
        }
        return { merged, conflicts: [] }
    }

    const handledGroups = new Set<readonly string[]>()
    for (const field of fields) {
        if (isExcludedField(field)) continue
        // 服务端 owned 派生计数：恒取 R
        if (SERVER_OWNED_FIELDS.has(field)) {
            merged[field] = remote[field]
            continue
        }
        const group = groupOf(field)
        if (group) {
            if (handledGroups.has(group)) continue
            handledGroups.add(group)
            const present = fields.filter(
                (candidate) => group.includes(candidate) && !isExcludedField(candidate)
            )
            const decision = decideGroup(base, remote, local, present, lwwWinner)
            for (const member of present) merged[member] = decision.values[member]
            if (decision.conflict) for (const member of present) conflicts.add(member)
            continue
        }
        if (field === 'tags') {
            const decision = decideTags(base, remote, local, lwwWinner)
            merged[field] = decision.value
            if (decision.conflict) conflicts.add(field)
            continue
        }
        if (field === 'archivedAt') {
            const decision = decideArchivedAt(base, remote, local, lwwWinner)
            merged[field] = decision.value
            if (decision.conflict) conflicts.add(field)
            continue
        }
        // 排序值：本地 0 = 未设置（服务端分配）⇒ 取 R
        if (field === SORT_FIELD && local[field] === 0) {
            merged[field] = remote[field]
            continue
        }
        const decision = decideScalar(base, remote, local, field, lwwWinner)
        merged[field] = decision.value
        if (decision.conflict) conflicts.add(field)
    }

    return { merged, conflicts: fields.filter((field) => conflicts.has(field)) }
}