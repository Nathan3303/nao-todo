import { describe, expect, it } from 'vite-plus/test'
import { prioritySNMap, TASK_PRIORITIES } from '@nao-todo/domain-task'
import { TaskPrioritySelectOptions } from '../labels'

/**
 * T582 / DEF-84 优先级选择器四档（PRD `docs/prds/2026-10-30-priority-urgent.md` AC2 / AC6 · R1 / R4）
 * @description **红基线（T582，DEF-84）**：现状选择器只有低 / 中 / 高 三档，缺「紧急」。
 *              断言口径（源级 + 关系级，不钉实现细节）：
 *              ① 选项值集合 = domain `TASK_PRIORITIES`（R1 单一来源，禁在选择器另写一份枚举）；
 *              ② 每档都有**非空文字标签**且不是原始键名（AC6/R4：不只靠颜色区分，且「说人话」）；
 *              ③ 「紧急」档标签可读为「紧急」，且不与「低」混淆（AC1/AC6 三重冗余的文字冗余）。
 */

const options = () => TaskPrioritySelectOptions.value

describe('T582 优先级选择器四档（presentation/task/constants）', () => {
    it('AC2/R1：选项值集合 = domain TASK_PRIORITIES（单一来源，不另写枚举）', () => {
        expect(
            options()
                .map((option) => option.value)
                .sort()
        ).toEqual([...(TASK_PRIORITIES as readonly string[])].sort())
        const rank = prioritySNMap as Record<string, number>
        for (const option of options()) {
            expect(typeof rank[option.value], `prioritySNMap 缺少档位 ${option.value}`).toBe(
                'number'
            )
        }
    })

    it('AC6/R4：每档都有非空文字标签与图标（不只靠颜色区分）', () => {
        for (const option of options()) {
            expect(option.label.trim().length, `档位 ${option.value} 缺少文字标签`).toBeGreaterThan(
                0
            )
            // 标签必须是给人看的文案，不能直接裸露内部键名（C 端「说人话」红线）
            expect(option.label).not.toBe(option.value)
            expect(typeof option.icon).toBe('string')
        }
        // 四档标签互不相同（防复制粘贴造成「两档同名」）
        const labels = options().map((option) => option.label)
        expect(new Set(labels).size).toBe(labels.length)
    })

    it('AC1/AC6：紧急档存在且标签可读为「紧急」，不与「低」混淆', () => {
        const urgent = options().find((option) => option.value === 'urgent')
        expect(urgent, '优先级选择器缺少「紧急」档').toBeTruthy()
        expect(urgent!.label).toContain('紧急')
        expect(urgent!.label).not.toContain('低')
    })
})