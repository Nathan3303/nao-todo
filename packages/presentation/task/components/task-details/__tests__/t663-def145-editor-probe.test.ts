// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, nextTick, provide, ref } from 'vue'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueEmpty,
    NueFooter,
    NueHeader,
    NueIcon,
    NueInput,
    NueMain,
    NueProgress,
    NueText,
    NueTextarea
} from 'nue-ui'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore, useTaskDetailsStore } from '../../../stores'
import useTaskViewObject from '../use-task-view-object'
import useSubTasks from '../use-subtasks'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import DetailsMain from '../main/index.vue'
import SubTasksComp from '../main/subtasks.vue'

/**
 * `T663` · `DEF-145`（含子任务区同族）**独立复验探针**（QA 自写，不复用 RD 用例/断言）
 *
 * @description 复验对象 `c4d758d5` + `a99a25df`。按本仓前端验证纪律，**真实挂载生产组件**：
 *              · `task-details/main/index.vue` —— 生产详情主面板（名称/描述 `nue-textarea` + `@change` 提交）；
 *              · `task-details/main/subtasks.vue` —— 生产子任务区（`v-if` 加载态 + `input-button` 新建框）。
 *              只 stub 需要路由/评论/检查事项接线的兄弟板块（与本缺陷无关）。
 *
 * 断言（AC-B1 / AC-B2 / AC-A3）：
 *   ① 编辑中字段：连续 3 轮刷新后 **DOM 值 / 焦点 / 光标** 三者全保持；
 *   ② 同条非编辑字段：照常跟随 store（不得「保护一条 ⇒ 整条冻结」）；
 *   ③ 子任务区：首进有 loading（AC-A3）；刷新期间「新建子任务」框不被卸载、文字不丢、无 loading 分支；
 *   ④ 子任务静默刷新失败 ⇒ 错误可见（不被 silent 吞掉）。
 */

const flush = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        // nue-textarea / nue-input 的 `debounceTime: 0` ⇒ 宏任务
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        userId: 'u1',
        parentTaskId: '',
        name: '原名字',
        description: '原描述',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
        deletedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        archivedAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 0,
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        ...overrides
    }) as TaskViewObject

const NUE = {
    'nue-button': NueButton,
    'nue-container': NueContainer,
    'nue-content': NueContent,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-footer': NueFooter,
    'nue-header': NueHeader,
    'nue-icon': NueIcon,
    'nue-input': NueInput,
    'nue-main': NueMain,
    'nue-progress': NueProgress,
    'nue-text': NueText,
    'nue-textarea': NueTextarea
}

/** 与本缺陷无关、依赖路由/评论/检查事项数据的板块：stub（被测接线 = 名称/描述编辑器与子任务区，真挂载） */
const UNRELATED_STUBS = {
    'details-main-comments': true,
    'details-main-events': true,
    'details-main-pomodoro-info': true
}

let wrappers: VueWrapper[] = []

beforeEach(() => {
    setActivePinia(createPinia())
    wrappers = []
})

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const typeInto = async (el: HTMLTextAreaElement, text: string, caret: number): Promise<void> => {
    el.focus()
    el.value = text
    el.dispatchEvent(new Event('input'))
    el.setSelectionRange(caret, caret)
    await flush()
}

/** 详情面板上下文（生产形态由 `task-details.ts` provide；此处只补齐与本缺陷无关的字段） */
const makeDetailsContext = (
    vo: ReturnType<typeof useTaskViewObject>['task'],
    api: ReturnType<typeof useTaskViewObject>
) => ({
    dialogManager: { open: vi.fn(), close: vi.fn() },
    vo,
    refreshKey: ref(1),
    projects: ref([]),
    tags: ref([]),
    checkItems: ref([]),
    comments: ref([]),
    subTasks: ref([]),
    taskHandler: { updateTaskState: vi.fn(async () => null) },
    subTaskHandler: { updateTaskState: vi.fn(async () => null) },
    checkItemHandler: { create: vi.fn(async () => null), update: vi.fn(async () => null) },
    commentHandler: { create: vi.fn(async () => null) },
    checkItemProgress: computed(() => ({ percentage: 0, text: '0/0' })),
    subTaskProgress: computed(() => ({ percentage: 0, text: '暂无子任务' })),
    isCommenting: ref(false),
    pomodoroCurrentTaskId: ref(null),
    pomodoroTimerStatus: ref(''),
    pomodoroFocusStatus: ref(''),
    checkItemsLoading: ref(false),
    checkItemsError: ref(''),
    commentsLoading: ref(false),
    commentsError: ref(''),
    subTasksLoading: ref(false),
    subTasksError: ref(''),
    updateTaskDetails: api.updateTaskDetails,
    deleteTask: api.deleteTask,
    restoreTask: api.restoreTask,
    giveUpTask: api.giveUpTask,
    ungiveUpTask: api.ungiveUpTask,
    switchTaskDetails: vi.fn(),
    closeDetails: vi.fn(),
    retryCheckItems: vi.fn(),
    retryComments: vi.fn(),
    retrySubTasks: vi.fn(),
    createSubTask: vi.fn(async () => null),
    detachSubTask: vi.fn(async () => null),
    resortSubTasks: vi.fn(async () => null),
    resortCheckItems: vi.fn(async () => null),
    makeCheckItemToTask: vi.fn(async () => null),
    selectTaskAndStartTimer: vi.fn(),
    selectTaskAndStartFocus: vi.fn(),
    resetTimer: vi.fn(),
    resetFocus: vi.fn()
})

/** 真实挂载生产详情主面板（`DetailsMain` 自身从 inject 取上下文，与生产一致） */
const mountRealDetails = async (seed: TaskViewObject) => {
    const store = useTasksStore()
    store.addTask({ ...seed })
    const update = vi.fn(async (_id: string, _vo: Record<string, unknown>) => null)
    const taskUseCase = {
        get: vi.fn(async () => [{ ...seed }, null]),
        update,
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null)
    } as unknown as TaskUseCase

    const Host = defineComponent({
        components: { DetailsMain },
        setup() {
            const api = useTaskViewObject(
                taskUseCase,
                () => undefined,
                () => ''
            )
            void api.getTaskDetails(seed.id)
            provide(TASK_DETAILS_CONTEXT_KEY, makeDetailsContext(api.task, api) as never)
            return {}
        },
        template: `<details-main />`
    })

    const wrapper = mount(Host, {
        // `attachTo` 必需：未挂到 `document` 的元素无法获得真实焦点（jsdom 下 `activeElement` 恒 body）
        attachTo: document.body,
        global: { components: NUE, stubs: UNRELATED_STUBS }
    })
    wrappers.push(wrapper)
    await flush()
    return { wrapper, store, update }
}

describe('T663 / DEF-145 · 真实详情面板：连续 3 轮自动刷新，未保存输入的值/焦点/光标全保持', () => {
    it('AC-B1：描述框的值 / 焦点 / 光标保持；AC-B2：同条未编辑的 name 照常跟随 store', async () => {
        const { wrapper, store, update } = await mountRealDetails(makeTask())

        const textareas = wrapper.findAll(
            'textarea.nue-textarea__textarea:not(.nue-textarea__backend-textarea)'
        )
        expect(textareas.length, '真实详情面板应有 名称 + 描述 两个 textarea').toBe(2)
        const nameEl = textareas[0]!.element as HTMLTextAreaElement
        const descEl = textareas[1]!.element as HTMLTextAreaElement

        const TYPED = '我正在输入的描述（未保存）'
        await typeInto(descEl, TYPED, 6)
        expect(descEl.value).toBe(TYPED)

        // 三轮自动刷新（生产：30s 一轮；回拉窗口每轮重放同一条 ⇒ 多轮必然发生）
        const rounds: Array<Partial<TaskViewObject>> = [
            { description: '云端第一轮描述', priority: 'high' },
            { description: '云端第二轮描述', priority: 'urgent' },
            { description: '云端第三轮描述', name: '云端第三轮名字', state: 'done' }
        ]
        for (const [idx, patch] of rounds.entries()) {
            store.addTasks([{ ...makeTask(), ...patch }])
            await flush()
            console.log(
                `[T663/probeB1] round=${idx + 1}`,
                JSON.stringify({
                    descValue: descEl.value,
                    focused: document.activeElement === descEl,
                    caret: [descEl.selectionStart, descEl.selectionEnd],
                    nameValue: nameEl.value
                })
            )
            expect(descEl.value, `第 ${idx + 1} 轮刷新后描述框仍是用户输入`).toBe(TYPED)
            expect(document.activeElement, `第 ${idx + 1} 轮刷新后焦点仍在该框`).toBe(descEl)
            expect(
                [descEl.selectionStart, descEl.selectionEnd],
                `第 ${idx + 1} 轮刷新后光标位置不变`
            ).toEqual([6, 6])
        }

        expect(nameEl.value, '未编辑的 name 必须随 store 更新（不得整条冻结）').toBe(
            '云端第三轮名字'
        )
        expect(update, '刷新不得触发提交').not.toHaveBeenCalled()
    })

    it('提交（`@change`）：载荷只含本次字段（零夹带），提交后该字段重新跟随 store', async () => {
        const { wrapper, store, update } = await mountRealDetails(makeTask())
        const descEl = wrapper.findAll(
            'textarea.nue-textarea__textarea:not(.nue-textarea__backend-textarea)'
        )[1]!.element as HTMLTextAreaElement

        const TYPED = '我要保存的描述'
        await typeInto(descEl, TYPED, 4)
        // 用户离开输入框（生产：`nue-textarea` 的原生 change ⇒ `@change="updateTaskDescription"`）
        descEl.dispatchEvent(new Event('change'))
        await flush()

        console.log('[T663/probeB1:submit] 载荷 =', JSON.stringify(update.mock.calls[0]?.[1]))
        expect(update, '提交必须发生且只一次').toHaveBeenCalledTimes(1)
        expect(update.mock.calls[0]![1], '载荷不得夹带任何「保护」字段').toEqual({
            description: TYPED
        })

        // 提交后：该字段不再是「未保存编辑」⇒ 重新跟随 store
        store.addTasks([{ ...makeTask(), description: '后续云端描述' }])
        await flush()
        expect(descEl.value, '提交后该字段应重新跟随 store').toBe('后续云端描述')
    })
})

describe('T663 / DEF-144 · 子任务区（真实组件）：首进 loading、刷新原地、失败可见', () => {
    const PARENT_ID = 'p1'

    const mountSubtasks = async () => {
        const store = useTaskDetailsStore()
        let refreshHandler: (() => void) | null = null
        const subscriber = {
            emit: vi.fn(),
            subscribe: (event: string, cb: () => void) => {
                if (event === 'RefreshData') refreshHandler = cb
            },
            unsubscribe: vi.fn()
        }
        let responder: () => unknown = () => undefined
        const list = vi.fn(async () => {
            const custom = responder()
            if (custom !== undefined) return custom
            const ids = ['s1', 's2']
            // 生产语义：`taskUseCase.list` 会把实体写回 store
            ids.forEach((id, idx) =>
                store.addTask({ ...makeTask({ id, parentTaskId: PARENT_ID }), sortId: idx * 1000 })
            )
            return [
                {
                    taskIds: ids,
                    pagination: { total: ids.length, page: 1, limit: 100, maxPage: 1 }
                },
                null
            ]
        })
        const subTaskUseCase = { list } as unknown as TaskUseCase

        let api: ReturnType<typeof useSubTasks> | null = null
        const Host = defineComponent({
            components: { SubTasksComp },
            setup() {
                api = useSubTasks(store, ref(null))
                const ctx = makeDetailsContext(ref(null) as never, {} as never)
                provide(TASK_DETAILS_CONTEXT_KEY, {
                    ...ctx,
                    subTasks: api.subTasks,
                    subTasksLoading: api.subTasksLoading,
                    subTasksError: api.subTasksError,
                    retrySubTasks: api.retrySubTasks,
                    createSubTask: async () => null,
                    resortSubTasks: api.resortSubTasks
                } as never)
                return {}
            },
            template: `<sub-tasks-comp />`
        })

        const wrapper = mount(Host, {
            attachTo: document.body,
            global: {
                components: NUE,
                provide: {
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: { subTaskUseCase, subscriber }
                }
            }
        })
        wrappers.push(wrapper)
        return {
            wrapper,
            store,
            api: api!,
            refresh: () => refreshHandler?.(),
            setResponder: (next: () => unknown) => (responder = next),
            listCalls: () => list.mock.calls.length
        }
    }

    it('AC-A3：子任务首次加载显示 loading，加载完离开 loading', async () => {
        const { wrapper, api, setResponder, store } = await mountSubtasks()
        // 把首次加载挂起（与真实网络在飞同形），以便在「数据未到」时采样
        let release: (() => void) | null = null
        setResponder(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve([
                            {
                                taskIds: ['s1', 's2'],
                                pagination: { total: 2, page: 1, limit: 100, maxPage: 1 }
                            },
                            null
                        ])
                })
        )
        const pending = api.loadSubTasks(PARENT_ID)
        await flush()
        console.log(
            '[T663/probeC] 首进（数据未到） =',
            JSON.stringify({ loadingText: wrapper.text().includes('正在加载') })
        )
        expect(api.subTasksLoading.value, '首进必须置 loading').toBe(true)
        expect(wrapper.text(), '首进必须渲染加载态（不得「永不显示 loading」）').toContain(
            '正在加载'
        )

        release!()
        store.addTask({ ...makeTask({ id: 's1', parentTaskId: PARENT_ID }), sortId: 0 })
        store.addTask({ ...makeTask({ id: 's2', parentTaskId: PARENT_ID }), sortId: 1000 })
        await pending
        await flush()
        expect(api.subTasksLoading.value).toBe(false)
        expect(wrapper.text(), '加载完必须离开加载态').not.toContain('正在加载')
        expect(wrapper.findAll('.subtask-row').length).toBe(2)
    })

    it('刷新期间「新建子任务」输入框不被卸载：文字/节点身份保持，且不渲染 loading', async () => {
        const { wrapper, api, refresh, setResponder } = await mountSubtasks()
        await api.loadSubTasks(PARENT_ID)
        await flush()

        // 进入输入态并打字（未提交）
        const trigger = wrapper.findAll('button').find((b) => b.text().includes('子任务'))
        expect(trigger, '应有「新建子任务」按钮').toBeTruthy()
        await trigger!.trigger('click')
        await flush()
        const inputEl = wrapper.find('input.nue-input__input').element as HTMLInputElement
        inputEl.focus()
        inputEl.value = '我要新建的子任务'
        inputEl.dispatchEvent(new Event('input'))
        await flush()
        expect(inputEl.value).toBe('我要新建的子任务')

        const before = wrapper.findAll('.subtask-row').map((row) => row.element)
        // 让这轮刷新**在飞**（真实网络形态），在飞期间采样：不得出现 loading、输入框不得重建
        let release: (() => void) | null = null
        setResponder(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve([
                            {
                                taskIds: ['s1', 's2'],
                                pagination: { total: 2, page: 1, limit: 100, maxPage: 1 }
                            },
                            null
                        ])
                })
        )
        refresh()
        await flush()

        const afterInput = wrapper.find('input.nue-input__input')
        console.log(
            '[T663/probeC] 刷新后 =',
            JSON.stringify({
                inputExists: afterInput.exists(),
                inputValue: afterInput.exists()
                    ? (afterInput.element as HTMLInputElement).value
                    : null,
                rows: wrapper.findAll('.subtask-row').length,
                loadingText: wrapper.text().includes('正在加载')
            })
        )
        expect(afterInput.exists(), '输入框不得被卸载').toBe(true)
        expect((afterInput.element as HTMLInputElement).value, '未提交文字不得丢失').toBe(
            '我要新建的子任务'
        )
        expect(wrapper.text(), '刷新期间不得渲染子任务 loading').not.toContain('正在加载')
        expect(wrapper.findAll('.subtask-row').map((row) => row.element)).toEqual(before)
        expect(api.subTasksLoading.value, '刷新不得置子任务 loading').toBe(false)

        release!()
        await flush()
        expect((wrapper.find('input.nue-input__input').element as HTMLInputElement).value).toBe(
            '我要新建的子任务'
        )
    })

    it('失败可见：子任务静默刷新失败必须落可见错误（不得被 silent 吞掉）', async () => {
        const { wrapper, api, refresh, setResponder } = await mountSubtasks()
        await api.loadSubTasks(PARENT_ID)
        await flush()
        setResponder(() => [null, '10051 请求过于频繁，请稍后再试'])
        refresh()
        await flush()

        console.log(
            '[T663/probeC] 失败后 =',
            JSON.stringify({
                errorText: wrapper.text().includes('子任务获取失败'),
                loadingText: wrapper.text().includes('正在加载')
            })
        )
        expect(wrapper.text(), '失败必须可见').toContain('子任务获取失败')
        expect(api.subTasksError.value).not.toBe('')
        expect(wrapper.text(), '不得卡在加载态').not.toContain('正在加载')
    })
})