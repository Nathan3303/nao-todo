// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import tasksRoutes from '../tasks/routes'
import calendarRoutes from '../calendar/routes'
import searchRoutes from '../search/routes'

/**
 * T474 / ADR `2026-09-30-subview-route-taskid-convention.md`：子视图「可选 `:taskId?`」一致性约定**源级回归**
 * @description 约定：支持任务详情下钻的子视图**叶子路由必须带 `:taskId?`**，且**详情面板挂父级**
 *              （`<router-view>` 之外，切换不卸载）。本文件把约定钉死（tasks / calendar / search；不含番茄页）。
 */

const ENTRY_SOURCES: Record<'tasks' | 'calendar' | 'search', string> = {
    tasks: Object.values(
        import.meta.glob('/apps/web/src/views/index/tasks/entry.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    ).join('\n'),
    calendar: Object.values(
        import.meta.glob('/apps/web/src/views/index/calendar/entry.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    ).join('\n'),
    search: Object.values(
        import.meta.glob('/apps/web/src/views/index/search/entry.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    ).join('\n')
}

describe('T474 ① 叶子路由均带 :taskId?', () => {
    it('tasks：三条叶子均为 `:viewType(table|list|kanban)/:taskId?`', () => {
        const leaves = (tasksRoutes.children ?? []).flatMap((branch) =>
            (branch.children ?? []).map((leaf) => leaf.path)
        )
        expect(leaves).toEqual([
            ':viewType(table|list|kanban)/:taskId?',
            ':viewType(table|list|kanban)/:taskId?',
            ':viewType(table|list|kanban)/:taskId?'
        ])
    })

    it('calendar：三条叶子均为 `…/:taskId?`', () => {
        expect((calendarRoutes.children ?? []).map((c) => c.path)).toEqual([
            'monthly/:taskId?',
            'weekly/:taskId?',
            'daily/:taskId?'
        ])
    })

    it('search：`search/:taskId?`', () => {
        expect(searchRoutes.path).toBe('search/:taskId?')
    })
})

describe('T474 ②/⑤ 详情面板挂父级、且无重复挂载（源级）', () => {
    for (const view of ['tasks', 'calendar', 'search'] as const) {
        it(`${view}：entry 恰有 1 个 <task-details-adapter>，且不在 <router-view> 内`, () => {
            const source = ENTRY_SOURCES[view]
            expect(source, `${view} entry 读取`).not.toBe('')

            const occurrences = source.split('<task-details-adapter').length - 1
            expect(occurrences, `${view} 详情适配器挂载数`).toBe(1)

            // 面板不得嵌在 <router-view> … </router-view> 之间（否则切换子视图会卸载）
            const start = source.indexOf('<router-view')
            if (start >= 0) {
                const end = source.indexOf('</router-view>', start)
                expect(source.slice(start, end)).not.toContain('task-details-adapter')
            }
        })
    }
})

/**
 * T474 ③ 审计结论（**待 PM 裁决；本文件暂不锁此行为**）
 *
 * 实测：tasks 视图切换走「同名 `replace`，只传 `viewType`」（`components/tasks/{built-in-project/project/tag}/*.ts`），
 * **不会**补齐缺失的 `taskId` ⇒ `route.params.taskId` 变 `undefined` ⇒ 详情面板关闭：
 *   `/tasks/all/table/t1` + `replace({ name:'tasks-built-in-project-main', params:{ viewType:'list' } })`
 *     ⇒ `/tasks/all/list`（`taskId` 丢失；`projectId` 因属**父记录**而保留）。
 *
 * ADR 中「tasks 未暴露同类问题（同名 replace 会补齐 params）」的论断与当前 `vue-router` 实测不符。
 * 更显式做法（待裁决）：切换时透传当前 `taskId`（`params: { viewType, taskId: route.params.taskId }`，
 * `undefined` 时 vue-router 会省略该段），与番茄页侧栏导航同型。
 * 因派单要求「③ 只评估不擅自改」，本轮**未改产品路由**；裁决后补红→绿。
 */