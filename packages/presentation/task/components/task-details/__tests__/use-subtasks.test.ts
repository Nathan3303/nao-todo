// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, ref, type Ref } from 'vue'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import useSubTasks from '../use-subtasks'

/**
 * 子任务创建继承父任务清单与时间窗断言（TASK-01 / ADR U1–U5）
 * @description 仅 `projectId`/`startAt`/`endAt` 从父任务**创建时快照**继承（以 endAt 为锚、值快照禁重算）；
 *              `startAt`/`endAt` 一律显式给值（含 `null`，禁 `undefined`）；父 VO 缺失 ⇒ 未安排兜底不抛错。
 */

const PARENT_ID = 'parent-1'

const makeParentTask = (overrides: Partial<TaskDetailsViewObject> = {}): TaskDetailsViewObject =>
    ({
        id: PARENT_ID,
        projectId: null,
        startAt: null,
        endAt: null,
        ...overrides
    }) as TaskDetailsViewObject

let wrappers: VueWrapper[] = []

/**
 * 装配被测 composable
 * @description `createSubTask` 需 `currentParentTaskId`（由 `loadSubTasks` 置位）⇒ 测试先走一次加载；
 *              以组件 wrapper + `global.provide` 提供 `TASK_DETAILS_PRE_CONTEXT_KEY`（注入口径）。
 */
const setup = async (parentTask: Ref<TaskDetailsViewObject | null>) => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    const captured: { payload: Record<string, unknown> | null } = { payload: null }
    const create = vi.fn(async (vo: Record<string, unknown>) => {
        captured.payload = vo
        return [{ id: `sub-${create.mock.calls.length}`, name: vo.name }, null]
    })
    const list = vi.fn().mockResolvedValue([{ taskIds: [], pagination: undefined }, null])
    const subTaskUseCase = { create, list } as unknown as TaskUseCase

    let api: ReturnType<typeof useSubTasks> | null = null
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useSubTasks(store, parentTask)
                return () => null
            }
        }),
        {
            global: {
                provide: {
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                        subTaskUseCase,
                        subscriber: { emit: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }
                    }
                }
            }
        }
    )
    wrappers.push(wrapper)
    await api!.loadSubTasks(PARENT_ID)
    return { api: api!, create, captured }
}

beforeEach(() => {
    wrappers = []
})

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('useSubTasks.createSubTask - TASK-01 继承父任务清单与时间窗', () => {
    it('U1：两者皆有效且 start ≤ end ⇒ 三者与父逐字相等（值快照，含逾期窗口不重算）', async () => {
        const startAt = '2026-09-10T08:00:00.000Z'
        const endAt = '2026-09-10T09:30:00.000Z'
        const { api, captured } = await setup(
            ref(makeParentTask({ projectId: 'p1', startAt, endAt }))
        )
        await api.createSubTask('子任务')
        expect(captured.payload?.projectId).toBe('p1')
        expect(captured.payload?.startAt).toBe(startAt)
        expect(captured.payload?.endAt).toBe(endAt)

        // 逾期窗口同样逐字照抄（不换算、不改写）
        const overdueStart = '2020-01-01T00:00:00.000Z'
        const overdueEnd = '2020-01-02T00:00:00.000Z'
        const second = await setup(
            ref(makeParentTask({ projectId: 'p1', startAt: overdueStart, endAt: overdueEnd }))
        )
        await second.api.createSubTask('子任务')
        expect(second.captured.payload?.startAt).toBe(overdueStart)
        expect(second.captured.payload?.endAt).toBe(overdueEnd)
    })

    it('U2：父任务仅 endAt ⇒ 拷贝 endAt；startAt 为 null（不派生、未调用 fillStartAt）', async () => {
        const endAt = '2026-09-11T10:00:00.000Z'
        const { api, captured } = await setup(ref(makeParentTask({ endAt })))
        await api.createSubTask('子任务')
        expect(captured.payload?.endAt).toBe(endAt)
        expect(captured.payload?.startAt).toBeNull()
        expect(Object.hasOwn(captured.payload ?? {}, 'startAt')).toBe(true)
    })

    it('U3：endAt 缺失/无效 ⇒ 两者皆 null；startAt 无效/倒置 ⇒ 保留有效 endAt 仅 startAt 置 null', async () => {
        // 皆无 ⇒ 未安排
        const none = await setup(ref(makeParentTask()))
        await none.api.createSubTask('子任务')
        expect(none.captured.payload?.startAt).toBeNull()
        expect(none.captured.payload?.endAt).toBeNull()

        // 仅 startAt（无 endAt 锚 ⇒ 未安排，不虚构 endAt）
        const onlyStart = await setup(ref(makeParentTask({ startAt: '2026-09-10T08:00:00.000Z' })))
        await onlyStart.api.createSubTask('子任务')
        expect(onlyStart.captured.payload?.startAt).toBeNull()
        expect(onlyStart.captured.payload?.endAt).toBeNull()

        // endAt 无效 ⇒ 未安排
        const invalidEnd = await setup(ref(makeParentTask({ endAt: 'not-a-date' })))
        await invalidEnd.api.createSubTask('子任务')
        expect(invalidEnd.captured.payload?.startAt).toBeNull()
        expect(invalidEnd.captured.payload?.endAt).toBeNull()

        // 回归线：无效 startAt + 有效 endAt ⇒ **保留 endAt**，仅 startAt 置 null
        const invalidStart = await setup(
            ref(makeParentTask({ startAt: 'not-a-date', endAt: '2026-09-11T00:00:00.000Z' }))
        )
        await invalidStart.api.createSubTask('子任务')
        expect(invalidStart.captured.payload?.endAt).toBe('2026-09-11T00:00:00.000Z')
        expect(invalidStart.captured.payload?.startAt).toBeNull()

        // 回归线：start > end + 有效 endAt ⇒ **保留 endAt**，仅 startAt 置 null
        const inverted = await setup(
            ref(
                makeParentTask({
                    startAt: '2026-09-12T00:00:00.000Z',
                    endAt: '2026-09-11T00:00:00.000Z'
                })
            )
        )
        await inverted.api.createSubTask('子任务')
        expect(inverted.captured.payload?.endAt).toBe('2026-09-11T00:00:00.000Z')
        expect(inverted.captured.payload?.startAt).toBeNull()
    })

    it("U4：projectId 空（'' / null）⇒ 收集箱语义，且 payload 显式 null 而非 undefined", async () => {
        const emptyString = await setup(ref(makeParentTask({ projectId: '' })))
        await emptyString.api.createSubTask('子任务')
        expect(emptyString.captured.payload?.projectId).toBe('')
        // C-T3：禁 undefined（dayjs(undefined) = now ⇒ 误报 START_AFTER_END）
        expect(Object.hasOwn(emptyString.captured.payload ?? {}, 'startAt')).toBe(true)
        expect(Object.hasOwn(emptyString.captured.payload ?? {}, 'endAt')).toBe(true)
        expect(emptyString.captured.payload?.startAt).toBeNull()
        expect(emptyString.captured.payload?.endAt).toBeNull()

        const nullProject = await setup(ref(makeParentTask({ projectId: null })))
        await nullProject.api.createSubTask('子任务')
        expect(nullProject.captured.payload?.projectId).toBeNull()

        // 有清单时原样拷贝
        const withProject = await setup(ref(makeParentTask({ projectId: 'p9' })))
        await withProject.api.createSubTask('子任务')
        expect(withProject.captured.payload?.projectId).toBe('p9')
    })

    it('U5：父 VO 缺失 ⇒ 未安排 + 收集箱兜底，不抛错且创建成功', async () => {
        const { api, captured } = await setup(ref<TaskDetailsViewObject | null>(null))
        const err = await api.createSubTask('子任务')
        expect(err).toBeNull()
        expect(captured.payload?.projectId).toBeNull()
        expect(captured.payload?.startAt).toBeNull()
        expect(captured.payload?.endAt).toBeNull()
        expect(captured.payload?.parentTaskId).toBe(PARENT_ID)
    })
})

describe('useSubTasks - DEF-STORE-06 方向 2（RefreshData 失效重取）', () => {
    /** 迷你事件总线（模拟 appSubscriber 的 subscribe/unsubscribe/emit 语义） */
    const createMiniSubscriber = () => {
        const cbs = new Map<string, Set<() => void>>()
        return {
            emit: (name: string) => cbs.get(name)?.forEach((cb) => cb()),
            subscribe: (name: string, cb: () => void) => {
                if (!cbs.has(name)) cbs.set(name, new Set())
                cbs.get(name)!.add(cb)
            },
            unsubscribe: (name: string, cb: () => void) => {
                cbs.get(name)?.delete(cb)
            }
        }
    }

    it('收到 RefreshData 后按当前父任务整体重取（等价 initialize()），卸载后不再重取', async () => {
        setActivePinia(createPinia())
        const store = useTaskDetailsStore()
        const subscriber = createMiniSubscriber()
        const list = vi
            .fn()
            .mockResolvedValueOnce([{ taskIds: ['s1'], pagination: undefined }, null])
            .mockResolvedValueOnce([{ taskIds: ['s1', 's2'], pagination: undefined }, null])
        const subTaskUseCase = { create: vi.fn(), list } as unknown as TaskUseCase

        let api: ReturnType<typeof useSubTasks> | null = null
        const wrapper = mount(
            defineComponent({
                setup() {
                    api = useSubTasks(store, ref(null) as Ref<TaskDetailsViewObject | null>)
                    return () => null
                }
            }),
            {
                global: {
                    provide: {
                        [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                            subTaskUseCase,
                            subscriber
                        }
                    }
                }
            }
        )
        wrappers.push(wrapper)
        await api!.loadSubTasks('parent-1')
        expect(list).toHaveBeenCalledTimes(1)
        // 应用级 RefreshData（由 store-invalidation hub 派发）⇒ 整体重取当前父任务
        subscriber.emit('RefreshData')
        await new Promise((r) => setTimeout(r, 0))
        expect(list).toHaveBeenCalledTimes(2)
        expect(list.mock.calls[1]![0]?.parentTaskId).toBe('parent-1')
        // 卸载 ⇒ 反订阅 ⇒ 再触发不重取（防泄漏/重复重取）
        wrapper.unmount()
        subscriber.emit('RefreshData')
        await new Promise((r) => setTimeout(r, 0))
        expect(list).toHaveBeenCalledTimes(2)
    })
})