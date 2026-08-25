import {
    TaskCheckItemUseCase,
    TaskCommentUseCase,
    TaskDomain,
    TaskUseCase,
    type CreateTaskCheckItemViewObject,
    type CreateTaskCommentViewObject,
    type CreateTaskViewObject,
    type TaskStore,
    type TaskViewObject,
    type UpdateTaskCheckItemViewObject,
    type UpdateTaskCommentViewObject,
    type UpdateTaskViewObject
} from '@nao-todo/domain-task'
import { TaskCheckItemRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-check-item-repo-impl'
import { TaskCommentRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-comment-repo-impl'
import { TaskRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-repo-impl'
import type { GetTasksOptions } from '@nao-todo/shared/constants/task'
import type { Requester } from '@nao-todo/shared/requester/types'
import type { GoError } from '@nao-todo/shared/types'
import type { TaskStoreCore } from './task-store-core'

/**
 * 任务用例接口（组合后的门面）
 * @description 封装 TaskUseCase / TaskCheckItemUseCase / TaskCommentUseCase，
 *              页面/组件只消费本接口暴露的方法，不直接触碰领域用例（React Hook 为 DI 唯一入口）。
 */
export type ComposedTaskUseCase = {
    // --- Task ---
    getTask: (id: string) => ReturnType<TaskUseCase['get']>
    listTasks: (options: GetTasksOptions) => ReturnType<TaskUseCase['list']>
    createTask: (viewObject: CreateTaskViewObject) => ReturnType<TaskUseCase['create']>
    updateTask: (id: string, update: UpdateTaskViewObject) => Promise<GoError>
    deleteTask: (id: string) => Promise<GoError>
    restoreTask: (id: string) => Promise<GoError>
    // --- TaskCheckItem ---
    listCheckItems: (taskId: string) => ReturnType<TaskCheckItemUseCase['list']>
    createCheckItem: (viewObject: CreateTaskCheckItemViewObject) => Promise<GoError>
    updateCheckItem: (id: string, update: UpdateTaskCheckItemViewObject) => Promise<GoError>
    deleteCheckItem: (id: string) => Promise<GoError>
    // --- TaskComment ---
    listComments: (taskId: string) => ReturnType<TaskCommentUseCase['list']>
    createComment: (viewObject: CreateTaskCommentViewObject) => Promise<GoError>
    updateComment: (id: string, update: UpdateTaskCommentViewObject) => Promise<GoError>
    deleteComment: (id: string) => Promise<GoError>
    // --- 子任务（独立 store 隔离区，parentTaskId 关联） ---
    listSubTasks: (parentTaskId: string) => ReturnType<TaskUseCase['list']>
    createSubTask: (parentTaskId: string, name: string) => ReturnType<TaskUseCase['create']>
    updateSubTaskState: (id: string, state: string) => Promise<GoError>
    deleteSubTask: (id: string) => Promise<GoError>
    restoreSubTask: (id: string) => Promise<GoError>
}

/**
 * 子任务 store 适配器
 * @description 实现 TaskStore 接口，委托 TaskStoreCore 的隔离区（subTask* 方法）；
 *              避免 TaskUseCase.list/create 写入主列表 store（Web 端同款隔离策略）。
 */
class SubTaskStoreAdapter implements TaskStore {
    constructor(private store: TaskStoreCore) {}

    subscribe = (): (() => void) => () => undefined

    get tasks(): TaskViewObject[] {
        return this.store.subTasks
    }
    setTasks = (tasks: TaskViewObject[]): void => this.store.setSubTasks(tasks)
    addTask = (task: TaskViewObject): void => this.store.addSubTask(task)
    addTasks = (tasks: TaskViewObject[]): void => {
        for (const task of tasks) this.store.addSubTask(task)
    }
    updateTask = (id: string, update: Partial<TaskViewObject>): void =>
        this.store.updateSubTask(id, update)
    getTask = (id: string): TaskViewObject | undefined => this.store.getSubTask(id)
    removeTask = (id: string): void => this.store.removeSubTask(id)
}

/**
 * 组装任务用例
 * @description Requester → Repos → TaskDomain → UseCases（复用 domain-task 全链路，
 *              shared 聚合依赖已改为 deep-import，Lynx 运行时安全）
 * @param requester 请求器（Lynx 端由 useLynxRequester 创建）
 * @param store 任务存储（实现 TaskStore/TaskCheckItemStore/TaskCommentStore）
 * @returns 任务用例门面
 */
export const composeTaskUseCase = (
    requester: Requester,
    store: TaskStoreCore
): ComposedTaskUseCase => {
    const taskRepo = new TaskRepoImpl(requester)
    const checkItemRepo = new TaskCheckItemRepoImpl(requester)
    const commentRepo = new TaskCommentRepoImpl(requester)
    const taskDomain = new TaskDomain(taskRepo)
    const taskUseCase = new TaskUseCase(taskDomain, taskRepo, store)
    // 子任务：同一 repo/domain + 独立 store 适配器（与主列表隔离）
    const subTaskUseCase = new TaskUseCase(taskDomain, taskRepo, new SubTaskStoreAdapter(store))
    const checkItemUseCase = new TaskCheckItemUseCase(checkItemRepo, store)
    const commentUseCase = new TaskCommentUseCase(commentRepo, store)

    return {
        getTask: (id) => taskUseCase.get(id),
        listTasks: (options) => taskUseCase.list(options),
        createTask: (viewObject) => taskUseCase.create(viewObject),
        updateTask: (id, update) => taskUseCase.update(id, update),
        deleteTask: (id) => taskUseCase.delete(id),
        restoreTask: (id) => taskUseCase.restore(id),
        listCheckItems: (taskId) => checkItemUseCase.list(taskId),
        createCheckItem: async (viewObject) => {
            const [, err] = await checkItemUseCase.create(viewObject)
            return err
        },
        updateCheckItem: (id, update) => checkItemUseCase.update(id, update),
        deleteCheckItem: async (id) => {
            const [, err] = await checkItemUseCase.delete(id)
            return err
        },
        listComments: (taskId) => commentUseCase.list(taskId),
        createComment: async (viewObject) => {
            const [, err] = await commentUseCase.create(viewObject)
            return err
        },
        updateComment: (id, update) => commentUseCase.update(id, update),
        deleteComment: async (id) => {
            const [, err] = await commentUseCase.delete(id)
            return err
        },
        listSubTasks: (parentTaskId) =>
            subTaskUseCase.list({ parentTaskId, limit: 20, isDeleted: false }),
        createSubTask: (parentTaskId, name) =>
            subTaskUseCase.create({
                parentTaskId,
                projectId: null,
                name,
                description: '',
                state: 'todo',
                priority: 'low',
                startAt: null,
                endAt: new Date().toISOString(),
                tags: [],
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: []
            }),
        updateSubTaskState: (id, state) => subTaskUseCase.update(id, { state }),
        deleteSubTask: async (id) => {
            // 后端软删成功后从隔离区移除（子任务为详情页临时视图，删除即消失；
            // 与主列表语义不同：主列表删除后经 listTasks 重新拉取）
            const err = await subTaskUseCase.delete(id)
            if (err === null) store.removeSubTask(id)
            return err
        },
        restoreSubTask: (id) => subTaskUseCase.restore(id)
    }
}