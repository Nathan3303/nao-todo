/**
 * 同步边界**唯一判等口径**（`DEF-135` / `R-1`）
 *
 * @description 从 `conflict-journal.ts` 下沉的底层比较原语（语义与实现**逐字不变**）：
 *              空值哨兵先归一（`null` ≡ `undefined` ≡ `''` ≡ `[]`），数组/对象再按 JSON 比较。
 *              ⛔ `0` 与 `false` **不是**空值。
 *
 *              下沉原因：`captureFieldBase`（`field-base.ts`）与 `conflict-journal` 都需要判等，
 *              而 `conflict-journal` 又要用 `captureFieldBase`（重试路径补基准）⇒ 若判等留在
 *              `conflict-journal` 会形成循环依赖。本模块**只依赖纯常量**（无 Dexie / 无 IO）。
 *
 *              调用方仍可从 `conflict-journal` 导入 `valuesEqual`（**re-export 保持公开 API 不变**）。
 */

/**
 * 空值哨兵（`null` / `undefined` / `''` / `[]`）—— 与展示层 `conflict-value-format.ts` 的
 * `isUnsetValue` **同一口径**（DEF-135：判等与展示不一致 ⇒ 两侧都渲染「未设置」却仍标差异）。
 * ⛔ `0` 与 `false` **不是**空值。
 */
const isEmptySentinel = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

/**
 * 深比较：**空值哨兵先归一**（`null` ≡ `undefined` ≡ `''` ≡ `[]`），数组/对象再按 JSON 比较
 *
 * @description **唯一判等实现**（DEF-135 / `R-1`）：读侧 `diffFields`、写侧 `recordPullLocalWins`
 *   （A1 快照字段挑选）、字段级合并（`field-merge`）、字段级基准捕获（`field-base`）**共用本函数**
 *   ——⛔ 禁第二套口径。
 */
export const valuesEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true
    const aEmpty = isEmptySentinel(a)
    const bEmpty = isEmptySentinel(b)
    if (aEmpty || bEmpty) return aEmpty && bEmpty
    if (typeof a !== 'object' || typeof b !== 'object') return false
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        return false
    }
}