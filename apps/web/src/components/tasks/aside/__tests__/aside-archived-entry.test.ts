import { describe, expect, it } from 'vite-plus/test'
import { t } from '@nao-todo/shared/locales'

/**
 * T180b · 侧栏「已归档」入口 —— 接线级单测（实现单自带）
 *
 * 真源：PRD §3-3 / ADR §7.1（DP-5：复用 `project-manager` 弹窗 + `archived` tab）
 *   - 侧栏底部「已归档」入口 ⇒ 打开清单管理器并**置 `archived` tab**；
 *   - 文案复用 `common.archived`（不新增键）。
 */

const asideModules = import.meta.glob('/apps/web/src/components/tasks/aside/**/*.{ts,vue}', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

const managerModules = import.meta.glob(
    '/packages/presentation/project/components/dialogs/manager/project-manager.vue',
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

const read = (modules: Record<string, string>, path: string): string => modules[`/${path}`] ?? ''

const asideVue = read(asideModules, 'apps/web/src/components/tasks/aside/aside.vue')
const useAsideTs = read(asideModules, 'apps/web/src/components/tasks/aside/use-aside.ts')
const managerVue = read(
    managerModules,
    'packages/presentation/project/components/dialogs/manager/project-manager.vue'
)

describe('T180b · 侧栏「已归档」入口接线', () => {
    it('aside.vue 存在「已归档」入口，点击 ⇒ 打开清单管理器并置 archived tab', () => {
        expect(asideVue).toContain("t('common.archived')")
        expect(asideVue).toContain("openProjectManager('archived')")
    })

    it('use-aside.ts 提供 openProjectManager（open(PROJECT_MANAGER_DIALOG_KEY, { activeTab })）', () => {
        expect(useAsideTs).toContain('PROJECT_MANAGER_DIALOG_KEY')
        expect(useAsideTs).toContain('openProjectManager')
        expect(useAsideTs).toContain('{ activeTab }')
    })

    it('清单管理器 open 支持 payload.activeTab（载荷驱动置 tab）', () => {
        expect(managerVue).toContain('payload?.activeTab')
        expect(managerVue).toContain('setActiveTab(payload.activeTab)')
    })

    it('文案复用 common.archived（中英非空，不新增键）', () => {
        expect(t('common.archived').length).toBeGreaterThan(0)
    })
})