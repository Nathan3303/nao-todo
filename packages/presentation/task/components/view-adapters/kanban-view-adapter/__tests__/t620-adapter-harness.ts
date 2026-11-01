import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { vi } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { GetTasksOptions } from '@nao-todo/shared/constants'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import KanbanViewAdapter from '../kanban-view-adapter.vue'
import { useTasksStore } from '../../../../stores'
import {
    KANBAN_GROUP_BY_KEY,
    NUE_COMPONENTS,
    settle,
    type KanbanGroupBy
} from '../../../kanban/__tests__/t608-kanban-harness'
import {
    createFakeTaskRepository,
    type FakeTaskRepository
} from '../../../kanban/__tests__/t620-fake-task-repository'

/**
 * `T620` 看板**页面适配器**用例 harness（`AC10` 三处一致 / `AC14` 新增任务）
 *
 * @description 三条页面（内置清单 / 普通清单 / 标签页）共用 `KanbanViewAdapter` ⇒ 适配器就是
 *              「同一实现」的唯一载体（PRD R-G）。此处**真实挂载适配器**（含真 `TaskKanban`、
 *              真 `nue-*`、真事件总线单例、真 Pinia store），只把 `taskUseCase` 换成内存仓储。
 *
 * 为什么需要它：
 *   ① `AC10` 的「三处一致」要能证明**共用那一份实现**真的会翻页（不是只在组件层翻）；
 *   ② `AC14` 的触发口是全局事件 `AddNewTaskId`（`subscriber.emit`，由创建流程发出）——
 *      它只出现在适配器（`props.subscriber`）这一层，组件层没有对应 prop。
 *
 * 注意：适配器里 `useTasksStore()` 是 Pinia store（`getTask(id)` 的数据源）⇒ 仓库内容需**同时**
 *       灌进 store（真实链路里 `taskUseCase.list` 会 `addTasks` 进 store，fake 仓储不做这件事）。
 */

export type KanbanAdapterHarness = {
    wrapper: VueWrapper
    repository: FakeTaskRepository
    /** 页面级事件总线（真单例）：`RefreshData` / `AddNewTaskId` 从这里发 */
    emit: (eventName: string, ...args: unknown[]) => void
    /** 模拟「新建任务成功」：写库 + 灌 store + 广播 `AddNewTaskId`（真实创建链路的三步） */
    addTask: (task: TaskViewObject) => Promise<void>
}

export type MountKanbanAdapterOptions = {
    groupBy?: KanbanGroupBy
    getTasksOptions?: GetTasksOptions
    updateResult?: string | null
}

export const mountKanbanAdapter = (
    tasks: TaskViewObject[],
    options: MountKanbanAdapterOptions = {}
): KanbanAdapterHarness => {
    const repository = createFakeTaskRepository(tasks, options.updateResult ?? null)
    const pinia = createPinia()
    setActivePinia(pinia)
    const tasksStore = useTasksStore(pinia)
    tasksStore.addTasks(tasks.map((task) => ({ ...task })))

    const groupBy = ref<KanbanGroupBy>(options.groupBy ?? 'state')
    const subscriber = useSubscriber()
    const dialogManager = { open: vi.fn(), close: vi.fn() }

    const wrapper = mount(KanbanViewAdapter, {
        attachTo: document.body,
        props: {
            taskUseCase: repository.taskUseCase,
            getTasksOptions: options.getTasksOptions ?? {},
            subscriber,
            dialogManager: dialogManager as never,
            tags: [],
            columns: { ...defaultColumns },
            multiSelectClearSignal: 0,
            getNoTaskError: () => undefined,
            getColumnLabel: (key: string) => key,
            getProjectName: () => '',
            showTaskDetails: vi.fn(),
            updateColumns: vi.fn(),
            updateSortOptions: vi.fn(),
            clearSortOptions: vi.fn()
        } as never,
        global: {
            plugins: [pinia],
            components: NUE_COMPONENTS,
            mocks: { $route: { params: {} } },
            provide: { [KANBAN_GROUP_BY_KEY]: groupBy }
        }
    })

    return {
        wrapper,
        repository,
        emit: (eventName, ...args) => subscriber.emit(eventName, ...args),
        addTask: async (task) => {
            repository.insert(task)
            tasksStore.addTask(task)
            subscriber.emit('AddNewTaskId', task.id)
            await settle()
        }
    }
}