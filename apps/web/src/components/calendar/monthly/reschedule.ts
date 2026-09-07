import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 排期内核（T1 改期统一语义 / U2 撤销快照原语）
 * @description 与 UI 解耦的纯函数模块（日历 monthly/ 共享内核；M2/F4、M3/F1 复用）：
 *              1. shiftTaskDates —— 计算「把任务放到目标日」应上送的字段（T1）：
 *                 - 已排期（有 endAt）且带 startAt：整体平移 Δ（目标日 − 原 endAt 所在日，天粒度），
 *                   起始时刻 HH:mm:ss.SSS 与日历日跨度原样保留（墙钟重建，跨 DST 亦精确）；
 *                 - 已排期但无 startAt：无平移锚点 → endAt 直写目标日 23:59:59.999；
 *                 - 未安排（endAt 为空）：endAt 直写目标日 23:59:59.999、startAt 保持不动（B7 等价）。
 *                 startAt 未变化时省略上送，保证小步写入。
 *              2. snapshotTaskDates —— U2 撤销快照：动作前保留 { id, prevStartAt, prevEndAt }，
 *                 还原时以快照原值再走一次普通 update（空值清空回 ''，DEF-1 契约，非 null）。
 * 目标日键（dateKey YYYY-MM-DD）非法一律返回 null（拒绝/不改的防御分支）。
 */

/** DEF-1 服务端清除语义：''=清除、null/省略=不改（快照/还原保持原值原样） */
export const SCHEDULE_CLEAR_VALUE = ''

/** 参与调度的时间字段（视图对象子集） */
export type TaskScheduleFields = Pick<TaskViewObject, 'startAt' | 'endAt'>

/** 调度应上送的补丁：startAt 未变化时省略（仅 endAt 变更的小步写入） */
export type SchedulePatch = {
    startAt?: TaskViewObject['startAt']
    endAt: TaskViewObject['endAt']
}

/** U2 撤销快照：动作前保留的任务时间前值（空值可能为 '' 或 null，均原样保留） */
export type TaskScheduleSnapshot = {
    id: TaskViewObject['id']
    prevStartAt: TaskViewObject['startAt']
    prevEndAt: TaskViewObject['endAt']
}

/** 批量排期执行摘要（父级完成串行写后回给抽屉用于选择收口） */
export type BatchScheduleResult = {
    ok: number
    fail: number
    failedIds: TaskViewObject['id'][]
}

/** U2 撤销 toast 动作数据（视图层动作入口；M2/M3 复用同一结构） */
export type ScheduleUndoAction = {
    text: string
    tone: 'success' | 'warning'
    snapshots: TaskScheduleSnapshot[]
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

/** 目标日键是否合法（YYYY-MM-DD、真实日期且回读一致；拒绝 2026-13-01/2026-02-30 等被宽松解析卷日的情况） */
export const isValidDateKey = (dateKey: string): boolean =>
    DATE_KEY_PATTERN.test(dateKey) &&
    dayjs(dateKey).isValid() &&
    dayjs(dateKey).format('YYYY-MM-DD') === dateKey

/**
 * 目标日所在自然日末时刻的 ISO（本地 23:59:59.999）
 * @description 按日期键的本地年月日直接组装，任何时区都不会偏移到相邻日
 *              （与「日期仅解析为 UTC 零点再转本地」的写法在 +08 等价，负时区更稳）。
 */
export const endOfDayIsoOf = (dateKey: string): string => {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(y!, m! - 1, d!, 23, 59, 59, 999).toISOString()
}

/** 日历日序数（1970-01-01 起的天数；按日期键的 UTC 日历计算，无 DST 23/25 小时误差） */
const dayOrdinalOf = (dateKey: string): number => {
    const [y, m, d] = dateKey.split('-').map(Number)
    return Math.floor(Date.UTC(y!, m! - 1, d!) / MS_PER_DAY)
}

/** 由日历日序数还原日期键 */
const dateKeyOfOrdinal = (ordinal: number): string => {
    const date = new Date(Date.UTC(1970, 0, 1 + ordinal))
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** 字符串是否为「空时间」（null/''/不可解析；空与非法均视为无值） */
const isBlankIso = (value: string | null | undefined): boolean =>
    value === null || value === undefined || value === '' || !dayjs(value).isValid()

/**
 * ISO 时间整体平移 Δ 天
 * @description 目标日 = 原所在日 + Δ，时刻 HH:mm:ss.SSS 按墙钟重建（跨 DST 也不会 ±1 小时漂移）；
 *              Δ=0 时原样返回（字符串级幂等）。
 */
const shiftIsoByDays = (iso: string, delta: number): string => {
    if (delta === 0) return iso
    const source = dayjs(iso)
    const targetKey = dateKeyOfOrdinal(dayOrdinalOf(source.format('YYYY-MM-DD')) + delta)
    const [y, m, d] = targetKey.split('-').map(Number)
    return new Date(
        y!,
        m! - 1,
        d!,
        source.hour(),
        source.minute(),
        source.second(),
        source.millisecond()
    ).toISOString()
}

/**
 * T1：计算把任务调度到目标日应上送的字段
 * @param fields 任务当前时间字段（动作前的原值）
 * @param targetDateKey 目标日键 YYYY-MM-DD（非法返回 null = 拒绝/不改）
 * @returns 上送补丁；startAt 未变时省略该键
 */
export const shiftTaskDates = (
    fields: TaskScheduleFields,
    targetDateKey: string
): SchedulePatch | null => {
    if (!isValidDateKey(targetDateKey)) return null
    const startAt = fields.startAt ?? ''
    const endAt = fields.endAt ?? ''
    const hasStartAt = !isBlankIso(startAt)
    const hasEndAt = !isBlankIso(endAt)
    if (!hasEndAt) {
        // 未安排（endAt 为空，含仅 startAt）：直写目标日末；startAt 保持不动（B7 等价语义）
        return { endAt: endOfDayIsoOf(targetDateKey) }
    }
    if (!hasStartAt) {
        // 已排期但无 startAt（无平移锚点）：endAt 直写目标日末，startAt 保持空
        return { endAt: endOfDayIsoOf(targetDateKey) }
    }
    // 已排期且带 startAt：Δ = 目标日 − 原 endAt 所在日（天粒度）；startAt/endAt 同步平移
    const delta = dayOrdinalOf(targetDateKey) - dayOrdinalOf(dayjs(endAt).format('YYYY-MM-DD'))
    const shiftedStartAt = shiftIsoByDays(startAt, delta)
    const shiftedEndAt = shiftIsoByDays(endAt, delta)
    const patch: SchedulePatch = { endAt: shiftedEndAt }
    if (shiftedStartAt !== startAt) patch.startAt = shiftedStartAt
    return patch
}

/**
 * U2：捕获任务时间前值快照
 * @description 必须在写回动作之前调用（动作后任务字段已被服务端/存储联动更新）
 */
export const snapshotTaskDates = (task: {
    id: TaskViewObject['id']
    startAt: TaskViewObject['startAt']
    endAt: TaskViewObject['endAt']
}): TaskScheduleSnapshot => ({
    id: task.id,
    prevStartAt: task.startAt,
    prevEndAt: task.endAt
})