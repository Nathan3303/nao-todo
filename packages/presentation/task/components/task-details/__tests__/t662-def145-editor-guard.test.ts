// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { NueTextarea } from 'nue-ui'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import useTaskViewObject from '../use-task-view-object'

/**
 * `T662` / `DEF-145` —— 自动刷新**不得**冲掉编辑器里未保存的输入（AC-B1 / AC-B2 / AC-B3）
 *
 * @description 复现路径（生产链路）：
 *              自动拉取落库 ⇒ `notifyDataChanged()` ⇒ `RefreshData` ⇒ 视图适配器重载
 *              ⇒ `taskUseCase.list()` ⇒ `taskStore.addTasks()` ⇒ 详情面板的 store 联动 watch。
 *              而 `SyncService.pullAllInnerLocked` 用 1s **回拉窗口**（`PULL_BACKTRACK_MS`）重放
 *              最近的行，`applyPullBatch` 对未变更行也无条件 `put` 并计入 `written`
 *              ⇒ **每个周期都会再发一次 `data-changed`** ⇒ 详情面板的 store 联动每次刷新都会跑一遍。
 *
 * 旧实现的洞：`lastSyncedText` 在**每次合并后**被推进到「本地已编辑值」⇒ 只挡得住**第一轮**刷新；
 *              第二轮把 `current === lastSyncedText` 判为「未编辑」⇒ 远端值覆盖未保存输入（实测丢字）。
 *
 * 断言（AC-B1）选择「**仅更新非编辑字段**」（字段级合并）：正在编辑的字段保值，其余字段照常跟随 store；
 * 这样其它行／该条其它字段照常刷新（AC-B2），用户保存后仍走既有 OCC / 冲突落账（AC-B3，零改动）。
 */

const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) {
        await nextTick()
        await Promise.resolve()
        // `nue-textarea` 的 `update:modelValue` 走 debounce（默认 0 ⇒ 宏任务）
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
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        ...overrides
    }) as TaskViewObject

const makeUseCase = (task: TaskViewObject) =>
    ({
        get: vi.fn(async () => [{ ...task }, null]),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null)
    }) as unknown as TaskUseCase

/** 模拟一轮自动刷新落库后的 store 重载（`list()` → `addTasks()` = 整体替换引用） */
const simulateRefreshReload = async (
    store: ReturnType<typeof useTasksStore>,
    next: TaskViewObject
): Promise<void> => {
    store.addTasks([{ ...next }])
    await flush()
}

beforeEach(() => {
    setActivePinia(createPinia())
})

describe('T662 / DEF-145 · 详情面板未保存输入在多轮自动刷新下保持（AC-B1）', () => {
    it('连续两轮刷新：编辑中的 name/description 保值，其余字段照常跟随（AC-B1 / AC-B2）', async () => {
        const remoteV1 = makeTask({ name: '云端改后的名字', description: '云端改后的描述' })
        const taskUseCase = makeUseCase(makeTask())
        const store = useTasksStore()
        store.addTask(makeTask())

        const { task, getTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        // 用户打字（textarea v-model 直接写 vo）
        task.value!.name = '我正在输入的名字'
        task.value!.description = '我正在输入的描述'
        await flush()

        // 第一轮刷新（pull 落库 → RefreshData → 列表重载 → store 替换）
        await simulateRefreshReload(store, remoteV1)
        expect(task.value!.name).toBe('我正在输入的名字')
        expect(task.value!.description).toBe('我正在输入的描述')

        // 第二轮刷新（回拉窗口重放同一行 ⇒ 生产上 30s 后必发生）
        await simulateRefreshReload(store, { ...remoteV1, priority: 'high' })
        expect(task.value!.name, '第二轮刷新不得覆盖未保存的 name').toBe('我正在输入的名字')
        expect(task.value!.description, '第二轮刷新不得覆盖未保存的 description').toBe(
            '我正在输入的描述'
        )
        // AC-B2：非编辑字段照常更新（没有因为保护一条而整轮停摆）
        expect(task.value!.priority).toBe('high')

        // 第三轮（更多字段变化）仍保值
        await simulateRefreshReload(store, { ...remoteV1, state: 'done' })
        expect(task.value!.name).toBe('我正在输入的名字')
        expect(task.value!.description).toBe('我正在输入的描述')
        expect(task.value!.state).toBe('done')
        expect(task.value!.isDone).toBe(true)
    })

    it('真实 nue-textarea：两轮刷新后 DOM 里仍是用户输入的文字（AC-B1 端到端）', async () => {
        const remoteV1 = makeTask({ description: '云端改后的描述' })
        const store = useTasksStore()
        store.addTask(makeTask())
        const taskUseCase = makeUseCase(makeTask())

        const Host = defineComponent({
            components: { NueTextarea },
            setup() {
                const { task, getTaskDetails } = useTaskViewObject(
                    taskUseCase,
                    () => undefined,
                    () => ''
                )
                void getTaskDetails('t1')
                return { task }
            },
            template: `<nue-textarea v-if="task" v-model="task.description" />`
        })

        const wrapper = mount(Host)
        await flush()

        const el = wrapper.find(
            'textarea.nue-textarea__textarea:not(.nue-textarea__backend-textarea)'
        ).element as HTMLTextAreaElement
        el.value = '我正在输入的描述'
        el.dispatchEvent(new Event('input'))
        await flush()
        expect(task_description(wrapper)).toBe('我正在输入的描述')

        await simulateRefreshReload(store, remoteV1)
        expect(task_description(wrapper), '第一轮刷新后 DOM 保持用户输入').toBe('我正在输入的描述')

        await simulateRefreshReload(store, { ...remoteV1, priority: 'urgent' })
        expect(task_description(wrapper), '第二轮刷新后 DOM 仍保持用户输入').toBe(
            '我正在输入的描述'
        )

        wrapper.unmount()
    })

    it('提交后重新跟随 store（不得把「已提交的值」永久钉住，AC-B3 前提）', async () => {
        const update = vi.fn(async (_id: string, _updateVO: Record<string, unknown>) => null)
        const taskUseCase = {
            get: vi.fn(async () => [{ ...makeTask() }, null]),
            update,
            delete: vi.fn(async () => null),
            restore: vi.fn(async () => null)
        } as unknown as TaskUseCase
        const store = useTasksStore()
        store.addTask(makeTask())
        const { task, getTaskDetails, updateTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        task.value!.description = '我保存的描述'
        const err = await updateTaskDetails('t1', { description: '我保存的描述' })
        expect(err).toBeNull()
        // AC-B4：裁决载荷零变化（不夹带任何「保护」字段）
        expect(update).toHaveBeenCalledTimes(1)
        expect(update.mock.calls[0]![1]).toEqual({ description: '我保存的描述' })
        await flush()

        // 提交后再来一轮刷新 ⇒ 该字段重新跟随 store（保护只针对「未保存」）
        await simulateRefreshReload(store, makeTask({ description: '后续云端描述' }))
        expect(task.value!.description).toBe('后续云端描述')
    })

    it('未编辑字段仍按 store 覆盖（不得因保护机制冻结整条记录，AC-B2 反向）', async () => {
        const taskUseCase = makeUseCase(makeTask())
        const store = useTasksStore()
        store.addTask(makeTask())
        const { task, getTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        await simulateRefreshReload(
            store,
            makeTask({ name: '云端新名', description: '云端新描述' })
        )
        expect(task.value!.name).toBe('云端新名')
        expect(task.value!.description).toBe('云端新描述')
    })
})

/** 读真实 textarea 的当前值（可见输入框，排除 autosize 的量高影子框） */
const task_description = (wrapper: VueWrapper): string =>
    (
        wrapper.find('textarea.nue-textarea__textarea:not(.nue-textarea__backend-textarea)')
            .element as HTMLTextAreaElement
    ).value

afterEach(() => {
    document.body.innerHTML = ''
})