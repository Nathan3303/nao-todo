// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, ref } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import TaskDetailsFooter from '../footer/index.vue'

/**
 * `T768` footer「更多」菜单的归档 / 取消归档门控（**真实挂载**，非源码断言）
 *
 * 口径：
 *   - 未归档的顶层任务 ⇒ 只出现「归档此任务」；
 *   - 已归档任务 ⇒ 只出现「取消归档」（两者互斥；ADR §15.1 逃生口在非归档清单下保留入口）；
 *   - 清单已归档 ⇒ 两项都不提供，改为一条可读的只读说明（`archive.readOnlyHint`）；
 *   - 子任务 ⇒ 不提供「归档此任务」（父任务归档即覆盖其可见性）。
 */

// --- 组件桩：只保留「渲染了哪些菜单项」这一可观测量 ---
const OptionStub = defineComponent({
    name: 'InnerDropdownOption',
    props: {
        title: { type: String, default: '' },
        executeId: { type: String, default: '' },
        disabled: { type: Boolean, default: false }
    },
    setup(props) {
        return () =>
            h('div', {
                class: 'option-stub',
                'data-execute-id': props.executeId,
                'data-title': props.title,
                'data-disabled': String(props.disabled)
            })
    }
})

const DropdownStub = defineComponent({
    name: 'NueDropdown',
    setup(_, { slots }) {
        return () =>
            h('div', { class: 'stub-dropdown' }, [
                slots.trigger?.({ trigger: () => {} }),
                slots.default?.()
            ])
    }
})

const DivBlockStub = defineComponent({
    name: 'DropdownDivBlock',
    props: { title: { type: String, default: '' } },
    setup(props, { slots }) {
        return () =>
            h('div', { class: 'block-stub', 'data-block-title': props.title }, slots.default?.())
    }
})

const stubs = {
    'nue-dropdown': DropdownStub,
    'nue-button': true,
    'nue-divider': true,
    'dropdown-div-block': DivBlockStub,
    'inner-dropdown-option': OptionStub,
    'task-project-selector': true,
    'task-export-dialog': true,
    'task-history-dialog': true
}

const makeTaskVo = (overrides: Partial<TaskDetailsViewObject> = {}): TaskDetailsViewObject =>
    ({
        id: 't-1',
        name: '任务',
        projectId: 'p-1',
        parentTaskId: '',
        tags: [],
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        description: '',
        archivedAt: null,
        isArchived: false,
        isDeleted: false,
        isStarMarked: false,
        isGivenUp: false,
        createdAt: '2026-11-01 08:00:00',
        updatedAt: '2026-11-01 20:00:00',
        ...overrides
    }) as unknown as TaskDetailsViewObject

let wrapper: VueWrapper | null = null

const mountFooter = (
    taskVo: TaskDetailsViewObject,
    options: { isProjectArchived?: (projectId: string) => boolean } = {}
) => {
    setActivePinia(createPinia())
    const vo = ref<TaskDetailsViewObject | null>(taskVo)

    wrapper = mount(TaskDetailsFooter, {
        global: {
            stubs,
            provide: {
                [TASK_DETAILS_CONTEXT_KEY as symbol]: {
                    vo,
                    projects: computed(() => []),
                    isCommenting: ref(false),
                    taskHandler: {
                        update: vi.fn(),
                        copyTask: vi.fn(),
                        archiveTask: vi.fn(),
                        unarchiveTask: vi.fn()
                    },
                    switchTaskDetails: vi.fn(),
                    dialogManager: { open: vi.fn() },
                    beginEdit: vi.fn(),
                    updateTaskDetails: vi.fn(),
                    deleteTask: vi.fn(),
                    restoreTask: vi.fn(),
                    giveUpTask: vi.fn(),
                    ungiveUpTask: vi.fn(),
                    isProjectArchived: options.isProjectArchived
                },
                [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                    subTaskUseCase: { list: vi.fn(async () => [{ taskIds: [] }, null]) },
                    taskCheckItemUseCase: { listByTask: vi.fn(async () => [[], null]) },
                    getTag: () => undefined,
                    getProjectName: () => ''
                }
            }
        }
    })
    return wrapper
}

const optionIds = (w: VueWrapper): string[] =>
    w.findAll('.option-stub').map((node) => node.attributes('data-execute-id') ?? '')

const optionTitles = (w: VueWrapper): string[] =>
    w.findAll('.option-stub').map((node) => node.attributes('data-title') ?? '')

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
})

describe('T768 · 详情「更多」菜单：归档 / 取消归档门控', () => {
    it('未归档的顶层任务（清单未归档）⇒ 只出现「归档此任务」', async () => {
        const w = mountFooter(makeTaskVo())
        await flushPromises()

        expect(optionIds(w)).toContain('archive-todo')
        expect(optionIds(w)).not.toContain('unarchive-todo')
        expect(optionTitles(w)).toContain(t('task.details.archive'))
    })

    it('已归档任务 ⇒ 只出现「取消归档」（两者互斥）', async () => {
        const w = mountFooter(
            makeTaskVo({ archivedAt: '2026-11-01T00:00:00.000Z', isArchived: true })
        )
        await flushPromises()

        expect(optionIds(w)).toContain('unarchive-todo')
        expect(optionIds(w)).not.toContain('archive-todo')
        expect(optionTitles(w)).toContain(t('task.details.unarchive'))
    })

    it('清单已归档 ⇒ 两项都不提供，改为可读的只读说明', async () => {
        const w = mountFooter(makeTaskVo(), { isProjectArchived: () => true })
        await flushPromises()

        expect(optionIds(w)).not.toContain('archive-todo')
        expect(optionIds(w)).not.toContain('unarchive-todo')
        // 只读说明可见且为可读文案（不是内部键名 / 错误码）
        expect(optionTitles(w)).toContain(t('archive.readOnlyHint'))
    })

    it('子任务 ⇒ 不提供「归档此任务」（父任务归档即覆盖其可见性）', async () => {
        const w = mountFooter(makeTaskVo({ parentTaskId: 'parent-1' }))
        await flushPromises()

        expect(optionIds(w)).not.toContain('archive-todo')
        expect(optionIds(w)).not.toContain('unarchive-todo')
    })

    it('清单取消归档后（清单状态变化）⇒ 入口恢复', async () => {
        // 与真实装配一致：`isProjectArchived` 在 computed 内读取响应式源（pinia 清单）
        const archived = ref(true)
        const w = mountFooter(makeTaskVo(), { isProjectArchived: () => archived.value })
        await flushPromises()
        expect(optionIds(w)).not.toContain('archive-todo')

        archived.value = false
        await flushPromises()

        expect(optionIds(w)).toContain('archive-todo')
    })
})