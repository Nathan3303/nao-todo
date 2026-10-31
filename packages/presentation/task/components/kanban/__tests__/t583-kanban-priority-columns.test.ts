import { describe, expect, it } from 'vite-plus/test'
import { TASK_PRIORITIES } from '@nao-todo/domain-task'
import { KANBAN_GROUP_BY_NAMES } from '../constants'

/**
 * T583 / DEF-84 看板优先级分组名单（PRD `docs/prds/2026-10-30-priority-urgent.md` AC8 · `T582` 裁定 A · R1）
 * @description 口径：看板优先级列**必须覆盖 domain 四档**（否则 `urgent` 任务无列可落 = 凭空消失），
 *              且列名全部来自 `TASK_PRIORITIES`（不另建一份枚举）。只断言**集合与相对序**，
 *              ⛔ 不钉字面量数组（等于把枚举复制进用例）。
 *              注：「拖拽后读写不回退」由 `persistence-*` 仓储用例与 `t582-urgent-priority-sync` 覆盖
 *              （拖拽只写 `state`，不写 `priority`；无优先级写路径变更）。
 */
describe('T583 看板优先级列含「紧急」', () => {
    const priorityColumns: readonly string[] = KANBAN_GROUP_BY_NAMES.priority

    it('AC8：优先级列覆盖全部四档（urgent 有列可落）', () => {
        expect([...priorityColumns].sort()).toEqual(
            [...(TASK_PRIORITIES as readonly string[])].sort()
        )
        expect(priorityColumns).toContain('urgent')
    })

    it('AC8/R1：列按优先级降序（紧急 → 高 → 中 → 低），列名不越出 domain 枚举', () => {
        const index = (priority: string) => priorityColumns.indexOf(priority)
        expect(index('urgent')).toBeLessThan(index('high'))
        expect(index('high')).toBeLessThan(index('medium'))
        expect(index('medium')).toBeLessThan(index('low'))
        expect(priorityColumns.every((name) => index(name) > -1)).toBe(true)
        // 不出现「幽灵列」（不在 domain 枚举内的旧值 / 拼写错）
        expect(
            priorityColumns.every((name) => (TASK_PRIORITIES as readonly string[]).includes(name))
        ).toBe(true)
    })
})