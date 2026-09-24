// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import type { ProjectViewObject } from '@nao-todo/domain-project'
import { useProjectsStore } from '../../../../stores'
import useProjectManager from '../use-project-manager'

/**
 * T178 用例先行 · 红基线（清单归档 —— 「已归档」面板 / DP-5）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md`（r1）§7.1 / DP-5：
 *   复用 `project-manager` 弹窗，新增 `archived` tab；条目 = 已归档清单；
 *   提供「取消归档」动作。
 *
 * ⚠️ 红基线：当前 `activeTab` 仅 'all' | 'active' | 'deleted'，无 `archived` 过滤 / 动作 ⇒ 应 **红**。
 *    不改任何实现文件。
 */

const makeProject = (overrides: Partial<ProjectViewObject> = {}): ProjectViewObject => ({
    id: 'p-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    icon: 'more2',
    name: '清单',
    description: null,
    archivedAt: null,
    deactivedAt: null,
    sortId: 1000,
    taskCount: 0,
    isArchived: false,
    isDeleted: false,
    ...overrides
})

const setup = (projects: ProjectViewObject[]) => {
    setActivePinia(createPinia())
    const store = useProjectsStore()
    store.setProjects(projects)
    const projectUseCase = {} as never
    const props = {
        projectUseCase,
        subscriber: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
        dialogManager: { open: vi.fn(), register: vi.fn(), close: vi.fn() }
    } as unknown as Parameters<typeof useProjectManager>[0]

    let api: ReturnType<typeof useProjectManager> | null = null
    mount(
        defineComponent({
            setup() {
                api = useProjectManager(props)
                return () => null
            }
        })
    )
    return api!
}

describe('T178 · 面5 「已归档」面板（project-manager archived tab，DP-5）', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it("activeTab 支持 'archived' 且 filteredProjects 仅返回已归档清单", () => {
        const api = setup([
            makeProject({ id: 'active-1', name: '活动清单' }),
            makeProject({
                id: 'archived-1',
                name: '归档清单',
                isArchived: true,
                archivedAt: '2026-09-01T00:00:00.000Z'
            }),
            makeProject({ id: 'deleted-1', name: '删除清单', isDeleted: true })
        ])

        const setActiveTab = api.setActiveTab as unknown as (tab: string) => void
        setActiveTab('archived')

        const ids = api.filteredProjects.value.map((p) => p.id)
        expect(ids).toEqual(['archived-1'])
    })

    it('已归档清单提供「取消归档」动作（unarchiveProject 可用）', () => {
        const api = setup([
            makeProject({
                id: 'archived-1',
                name: '归档清单',
                isArchived: true,
                archivedAt: '2026-09-01T00:00:00.000Z'
            })
        ])

        const shape = api as unknown as Record<string, unknown>
        expect(typeof shape.unarchiveProject).toBe('function')
    })
})