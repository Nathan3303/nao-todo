import { describe, expect, it } from 'vite-plus/test'
import { prioritySNMap, prioritySNMapReverse, TASK_PRIORITIES } from '../constants'

/**
 * T582 / DEF-84 优先级四档「单一来源」（PRD `docs/prds/2026-10-30-priority-urgent.md` AC3 · R1）
 * @description **红基线（T582，DEF-84）**：现状 `TASK_PRIORITIES` 只有三档、`prioritySNMap` 无 `urgent`。
 *              断言口径：
 *              ① 枚举与 rank **同源**（`TASK_PRIORITIES` 与 `prioritySNMap` 键集合一致，禁第二份映射）；
 *              ② 只断言**相对序**（紧急 > 高 > 中 > 低），⛔ 不钉 rank 字面量（否则等于复制一份映射）；
 *              ③ 反向映射自洽（`#urgent` 过滤语法可回读，属同一份单一来源）。
 */

/** 以 Record 视图读取，避免本用例先行时类型上尚无 `urgent` 键（红基线期仍可编译） */
const rankOf = (priority: string): number | undefined =>
    (prioritySNMap as Record<string, number>)[priority]

describe('T582 优先级四档单一来源（domain constants）', () => {
    it('AC2/AC3：TASK_PRIORITIES 含四档（低 / 中 / 高 / 紧急）', () => {
        const tiers = TASK_PRIORITIES as readonly string[]
        expect(tiers).toHaveLength(4)
        expect(tiers).toContain('low')
        expect(tiers).toContain('medium')
        expect(tiers).toContain('high')
        expect(tiers).toContain('urgent')
    })

    it('R1：prioritySNMap 键集合 = TASK_PRIORITIES（枚举与 rank 同源，无第二份映射）', () => {
        expect(Object.keys(prioritySNMap).sort()).toEqual(
            [...(TASK_PRIORITIES as readonly string[])].sort()
        )
        for (const priority of TASK_PRIORITIES as readonly string[]) {
            expect(typeof rankOf(priority), `prioritySNMap 缺少档位 ${priority} 的 rank`).toBe(
                'number'
            )
        }
    })

    it('AC3：rank 相对序 紧急 > 高 > 中 > 低（不断言字面量）', () => {
        expect(rankOf('urgent')!).toBeGreaterThan(rankOf('high')!)
        expect(rankOf('high')!).toBeGreaterThan(rankOf('medium')!)
        expect(rankOf('medium')!).toBeGreaterThan(rankOf('low')!)
    })

    it('R1：反向映射与正映射自洽（每档都能 rank → 值 回读）', () => {
        for (const priority of TASK_PRIORITIES as readonly string[]) {
            expect(prioritySNMapReverse[rankOf(priority)!], `反向映射缺失 ${priority}`).toBe(
                priority
            )
        }
    })
})