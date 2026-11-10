/**
 * 字段级基准（`B`）捕获（T676 / B 批 M1）
 *
 * @description 字段级三方合并（`B` × `R` × `L`）需要「**我改过的字段**在写前的旧值」。
 *              基准只在本地写点可得（写前已读旧行 / 旧实体），本模块提供**唯一**捕获口径：
 *              键集 = 本次写载荷（写后键集）里 `valuesEqual` 判不等的业务字段（忽略集单一来源），
 *              值 = **写前**的值（= 上次同步成功的值；「基准只前进」由 `markDirty` 的首次写胜保证）。
 *
 *              ⚠️ 传参必须是**同一形状**（实体对实体 / 记录对记录）：
 *              任务 `name` / `description` 落库为 `plain:<明文>`，与同步边界（实体明文）不同形状
 *              ⇒ 任务写路径在**实体层**捕获（`task-repo-impl.update` / `snooze`）；
 *              级联归档 / 脱归档只改非密文字段，记录层捕获等价。
 *
 * @see docs/adr/2026-11-10-field-level-merge.md（D1：写时捕获、零额外 IO、无 Dexie 版本变更）
 */

import { valuesEqual } from './conflict-journal'
import { SYNC_COMPARE_IGNORED_FIELDS } from './sync-normalize'

/** 字段级基准：`{ 字段名: 写前值 }`，只含本次写涉及的字段 */
export type FieldBase = Record<string, unknown>

/**
 * 捕获本次写涉及的字段级基准
 * @param before 写前旧值（实体或记录；缺失 ⇒ `undefined`，即「无基准」，下游走保守路径）
 * @param after 本次写后的新值（与 `before` 同形状）
 * @returns `{ field: 写前值 }`；无字段变化 ⇒ `undefined`（队列项不写 `fieldBase` 键）
 */
export const captureFieldBase = (
    before: object | undefined,
    after: object
): FieldBase | undefined => {
    if (!before) return undefined
    const from = before as Record<string, unknown>
    const to = after as Record<string, unknown>
    const base: FieldBase = {}
    let captured = false
    for (const field of Object.keys(to)) {
        if (SYNC_COMPARE_IGNORED_FIELDS.has(field)) continue
        if (valuesEqual(from[field], to[field])) continue
        base[field] = from[field]
        captured = true
    }
    return captured ? base : undefined
}