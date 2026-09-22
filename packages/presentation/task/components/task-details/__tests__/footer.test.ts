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

describe('TaskDetailsFooter - 点导出立即开框（TASK-22 §5.1 流程反转）', () => {
    // supersede（PM 2026-09-23 裁决 A）：原「取数失败 ⇒ 不开浮层」与 TASK-22 需求③（框内错误态
    // + 重试）直接互斥，属本单范围内行为替代。新不变量：是否开框**不依赖取数结果**。
    // 失败路径的 toast 与框内错误态改由 export-acceptance.test.ts（dialog 接线）覆盖；
    // footer 层不再断言 toast，故此处不再 mock 断言 NueMessage.error。
    it('点导出 ⇒ 不依赖取数结果，立即开浮层（失败 / 成功双 fetcher 对照，避免门控恒闭）', async () => {
        const failed = mountFooter(async () => [null, 'boom'])
        await triggerExport(failed)
        expect(failed.find('.export-open').exists()).toBe(true)
        failed.unmount()

        const succeeded = mountFooter(async () => emptyPage())
        await triggerExport(succeeded)
        expect(succeeded.find('.export-open').exists()).toBe(true)
    })
})