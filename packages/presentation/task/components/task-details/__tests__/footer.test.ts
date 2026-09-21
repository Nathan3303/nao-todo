// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import TaskDetailsFooter from '../footer/index.vue'

vi.mock('nue-ui', () => ({
    NueMessage: { success: vi.fn(), error: vi.fn() }
}))

/**
 * 任务详情 footer 导出入口门控（T33 AC5 遗留）
 * @description 「取数失败 ⇒ 不开浮层」的门控在 footer 的
 *              `if (text !== null) exportVisible.value = true`，由 `use-export-task`
 *              无法覆盖，故以 footer 组件用例补齐：失败不渲染浮层，成功才渲染。
 */

// --- nue-ui / 子组件 stubs ---

const DropdownStub = defineComponent({
    name: 'NueDropdown',
    emits: ['execute'],
    setup(_, { slots }) {
        return () => h('div', { class: 'stub-dropdown' }, slots.trigger?.({ trigger: () => {} }))
    }
})

const ExportDialogSpy = defineComponent({
    name: 'TaskExportDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        markdown: { type: String, default: '' }
    },
    emits: ['copy', 'update:modelValue'],
    setup(props) {
        return () => h('div', { class: props.modelValue ? 'export-open' : 'export-closed' })
    }
})

const stubs = {
    'nue-dropdown': DropdownStub,
    'nue-button': true,
    'nue-divider': true,
    'dropdown-div-block': true,
    'inner-dropdown-option': true,
    'task-project-selector': true,
    'task-export-dialog': ExportDialogSpy
}

type ListResult = [
    {
        taskIds: string[]
        pagination?: { total: number; page: number; limit: number; maxPage: number }
    } | null,
    string | null
]

const emptyPage = (): ListResult => [
    { taskIds: [], pagination: { total: 0, page: 1, limit: 100, maxPage: 1 } },
    null
]

let wrapper: VueWrapper | null = null

const taskVo = (): TaskDetailsViewObject =>
    ({
        id: 'root',
        name: '根任务',
        projectId: null,
        tags: [],
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        description: '',
        createdAt: '2026-09-19 08:00:00',
        updatedAt: '2026-09-19 20:00:00'
    }) as unknown as TaskDetailsViewObject

const mountFooter = (list: (options: { parentTaskId?: string }) => Promise<ListResult>) => {
    setActivePinia(createPinia())
    useTaskDetailsStore()
    const vo = ref<TaskDetailsViewObject | null>(taskVo())

    wrapper = mount(TaskDetailsFooter, {
        global: {
            stubs,
            provide: {
                [TASK_DETAILS_CONTEXT_KEY as symbol]: {
                    vo,
                    checkItems: computed(() => []),
                    projects: computed(() => []),
                    isCommenting: ref(false),
                    taskHandler: { update: vi.fn(), copyTask: vi.fn() },
                    switchTaskDetails: vi.fn(),
                    dialogManager: { open: vi.fn() },
                    updateTaskDetails: vi.fn(),
                    deleteTask: vi.fn(),
                    restoreTask: vi.fn(),
                    giveUpTask: vi.fn(),
                    ungiveUpTask: vi.fn()
                },
                [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                    subTaskUseCase: { list },
                    taskCheckItemUseCase: { listByTask: vi.fn(async () => [[], null]) },
                    getTag: () => undefined,
                    getProjectName: () => ''
                }
            }
        }
    })
    return wrapper
}

const triggerExport = async (w: VueWrapper) => {
    w.findComponent(DropdownStub).vm.$emit('execute', 'export-task')
    await flushPromises()
}

beforeEach(() => {
    vi.mocked(NueMessage.error).mockClear()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TaskDetailsFooter - 导出失败门控（AC5）', () => {
    it('取数失败 ⇒ 不开浮层（exportTask 返回 null 时 dialog 不渲染）', async () => {
        const w = mountFooter(async () => [null, 'boom'])

        await triggerExport(w)

        expect(NueMessage.error).toHaveBeenCalledTimes(1)
        expect(w.find('.export-open').exists()).toBe(false)
        expect(w.find('.export-closed').exists()).toBe(true)
    })

    it('取数成功 ⇒ 打开浮层（正向对照，避免门控恒闭）', async () => {
        const w = mountFooter(async () => emptyPage())

        await triggerExport(w)

        expect(w.find('.export-open').exists()).toBe(true)
    })
})