// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import TaskDetailsFooter from '../footer/index.vue'

vi.mock('nue-ui', () => ({
    NueMessage: { success: vi.fn(), error: vi.fn() }
}))

/**
 * TASK-22 T94 —— footer 流程反转 + 零重取集成断言（PRD §5.1 / §4 / AC1 / AC2 / AC5）
 * @description 契约：
 *  - 点「导出」**立即开框**（不再 `await exportTask()` 后按结果门控）；
 *  - 取数在框内触发：失败时浮层仍开，框内 LoadingError error + 「重试」，并保留失败 toast；
 *  - 格式切换仅本地重渲染 ⇒ **任务树取数调用次数不增加**（含检查项只读取数）。
 *
 * ⚠️ 用例先行：流程反转 / status / format v-model / json / html 属 T96，未落地 ⇒ 当前预期红。
 *    本文件用**真实对话框**（仅 stub nue-* 与 loading-error），以覆盖 footer↔dialog 接线。
 */

const DialogStub = defineComponent({
    name: 'NueDialog',
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    setup(props, { slots }) {
        return () =>
            props.modelValue
                ? h('div', { class: 'stub-dialog' }, [slots.content?.(), slots.footer?.()])
                : null
    }
})

const DivStub = defineComponent({
    name: 'NueDiv',
    setup(_, { slots }) {
        return () => h('div', { class: 'stub-div' }, slots.default?.())
    }
})

const ButtonGroupStub = defineComponent({
    name: 'NueButtonGroup',
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
        return () => h('div', { ...attrs, class: 'stub-button-group' }, slots.default?.())
    }
})

const ButtonStub = defineComponent({
    name: 'NueButton',
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { slots, emit, attrs }) {
        return () =>
            h(
                'button',
                { ...attrs, type: 'button', onClick: () => emit('click') },
                slots.default?.()
            )
    }
})

const TextareaStub = defineComponent({
    name: 'NueTextarea',
    props: { modelValue: { type: String, default: '' } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('textarea', {
                class: 'stub-textarea',
                value: props.modelValue,
                onInput: (event: Event) =>
                    emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
            })
    }
})

const LoadingErrorStub = defineComponent({
    name: 'LoadingError',
    props: {
        loading: { type: Boolean, default: false },
        error: { type: Boolean, default: false },
        errorMessage: { type: String, default: '' }
    },
    setup(props, { slots }) {
        return () =>
            h(
                'div',
                {
                    class: 'stub-loading-error',
                    'data-loading': String(props.loading),
                    'data-error': String(props.error)
                },
                props.error
                    ? [
                          h('span', { class: 'stub-error-message' }, props.errorMessage),
                          slots.error?.()
                      ]
                    : []
            )
    }
})

const DropdownStub = defineComponent({
    name: 'NueDropdown',
    emits: ['execute'],
    setup(_, { slots }) {
        return () => h('div', { class: 'stub-dropdown' }, slots.trigger?.({ trigger: () => {} }))
    }
})

const stubs = {
    NueDialog: DialogStub,
    'nue-dialog': DialogStub,
    NueDiv: DivStub,
    'nue-div': DivStub,
    NueButtonGroup: ButtonGroupStub,
    'nue-button-group': ButtonGroupStub,
    NueButton: ButtonStub,
    'nue-button': ButtonStub,
    NueTextarea: TextareaStub,
    'nue-textarea': TextareaStub,
    LoadingError: LoadingErrorStub,
    'loading-error': LoadingErrorStub,
    'nue-dropdown': DropdownStub,
    'nue-divider': true,
    'dropdown-div-block': true,
    'inner-dropdown-option': true,
    'task-project-selector': true
}

type ListResult = [
    {
        taskIds: string[]
        pagination?: { total: number; page: number; limit: number; maxPage: number }
    } | null,
    string | null
]

const pageOf = (taskIds: string[]): ListResult => [
    { taskIds, pagination: { total: taskIds.length, page: 1, limit: 100, maxPage: 1 } },
    null
]

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

let wrapper: VueWrapper | null = null

const mountFooter = (
    list: (options: { parentTaskId?: string; page?: number }) => Promise<ListResult>
): VueWrapper => {
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

const findButton = (w: VueWrapper, pattern: RegExp): DOMWrapper<Element> | undefined =>
    w.findAll('button').find((item) => pattern.test(item.text()))

beforeEach(() => {
    vi.mocked(NueMessage.error).mockClear()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TaskDetailsFooter - 流程反转：点导出立即开框（§5.1 / AC1）', () => {
    it('取数未完成时浮层已开（不再「先取数→成功才开框」）', async () => {
        let resolveList!: (value: ListResult) => void
        const list = vi.fn(
            () =>
                new Promise<ListResult>((resolve) => {
                    resolveList = resolve
                })
        )
        const w = mountFooter(list)

        w.findComponent(DropdownStub).vm.$emit('execute', 'export-task')
        await nextTick()

        expect(w.find('.stub-dialog').exists()).toBe(true)
        expect(w.find('[data-loading="true"]').exists()).toBe(true)

        resolveList(pageOf([]))
        await flushPromises()

        expect(w.find('textarea').exists()).toBe(true)
    })

    it('取数失败 ⇒ 浮层仍开、框内 error 态 + 「重试」+ 保留失败 toast', async () => {
        const w = mountFooter(async () => [null, 'boom'])

        await triggerExport(w)

        expect(w.find('.stub-dialog').exists()).toBe(true)
        expect(w.find('[data-error="true"]').exists()).toBe(true)
        expect(findButton(w, /重试|Retry/)).toBeTruthy()
        expect(NueMessage.error).toHaveBeenCalledWith('导出失败：boom')
    })

    it('框内「重试」⇒ 重新取数并恢复 ready', async () => {
        let attempt = 0
        const w = mountFooter(async () => {
            attempt += 1
            return attempt === 1 ? [null, 'boom'] : pageOf([])
        })

        await triggerExport(w)
        expect(w.find('[data-error="true"]').exists()).toBe(true)

        await findButton(w, /重试|Retry/)!.trigger('click')
        await flushPromises()

        expect(w.find('textarea').exists()).toBe(true)
        expect(w.find('[data-error="true"]').exists()).toBe(false)
    })
})

describe('TaskDetailsFooter - 格式切换零重取（§5.1 / §5.2 / AC2）', () => {
    it('Markdown → JSON → HTML 期间任务树取数调用次数不增加', async () => {
        const list = vi.fn(async () => pageOf([]))
        const w = mountFooter(list)

        await triggerExport(w)
        expect(w.find('textarea').exists()).toBe(true)

        const callsAfterReady = list.mock.calls.length

        await w.find('[data-format="json"]').trigger('click')
        await flushPromises()
        expect(w.find('pre').exists()).toBe(true)
        expect(list.mock.calls.length).toBe(callsAfterReady)

        await w.find('[data-format="html"]').trigger('click')
        await flushPromises()
        expect(w.find('iframe').exists()).toBe(true)
        expect(list.mock.calls.length).toBe(callsAfterReady)
    })
})