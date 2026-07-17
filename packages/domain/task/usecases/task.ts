import {
    type GoAsync,
    QueryOptionsValueObject,
    type GetTasksOptions,
    type ResponseDataPagination
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import { TaskRepository } from '../repositories'
import { TaskDomain } from '../services'
import type {
    CreateTaskViewObject,
    TaskStore,
    TaskViewObject,
    UpdateTaskViewObject
} from '../types'
import {
    createTaskViewObjectToValueObject,
    taskEntitiesToViewObjects,
    taskEntityToViewObject,
    updateTaskViewObjectToValueObject
} from './converters'

/**
 * 任务用例
 * @description 任务用例负责处理任务相关的业务逻辑，包括加载、删除、创建、更新任务等。
 */
export class TaskUseCase {
    /**
     * 任务用例
     * @param taskDomain 任务领域服务
     * @param taskRepo 任务仓库
     * @param taskStore 任务用例存储
     */
    constructor(
        private taskDomain: TaskDomain,
        private taskRepo: TaskRepository,
        private taskStore: TaskStore
    ) {}

    // --- Task ---

    /**
     * 加载任务
     * @param id 任务ID
     * @returns 任务视图对象
     */
    async get(id: TaskViewObject['id']): GoAsync<TaskViewObject> {
        // 获取任务实体
        const [taskEntity, err] = await this.taskRepo.get(id)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务
        this.taskStore.addTask(taskViewObject)
        // 实体转换为视图对象
        return [taskViewObject, null]
    }

    /**
     * 加载任务列表
     * @param getTasksOptions 获取任务选项
     * @returns 任务ID列表
     */
    async list(getTasksOptions: GetTasksOptions): GoAsync<{
        taskIds: TaskViewObject['id'][]
        pagination?: ResponseDataPagination
    }> {
        // 数据转换
        const queryOptionsVO = new QueryOptionsValueObject(getTasksOptions)
        // 获取任务实体列表
        const [listResult, err] = await this.taskDomain.listTasks(queryOptionsVO)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const { taskEntities, pagination } = listResult
        const taskViewObjects = taskEntitiesToViewObjects(taskEntities)
        const taskIds = taskViewObjects.map((task) => task.id)
        // 存储任务列表
        this.taskStore.addTasks(taskViewObjects)
        // 返回任务ID列表
        return [{ taskIds, pagination }, null]
    }

    /**
     * 删除任务
     * @param id 任务ID
     * @returns 错误信息
     */
    async delete(id: TaskViewObject['id']): GoAsync<void> {
        // 删除任务
        const err = await this.taskRepo.remove(id)
        if (err !== null) return err
        // 更新任务状态为已删除
        this.taskStore.updateTask(id, { deletedAt: dayjs().toISOString() })
        // 返回成功
        return null
    }

    /**
     * 恢复任务
     * @param id 任务ID
     * @returns 错误信息
     */
    async restore(id: TaskViewObject['id']): GoAsync<void> {
        // 恢复
        const err = await this.taskRepo.restore(id)
        if (err !== null) return err
        // 更新任务状态为未删除
        this.taskStore.updateTask(id, { deletedAt: null })
        // 返回成功
        return null
    }

    /**
     * 创建任务
     * @param createTaskViewObject 创建任务视图对象
     * @returns 任务视图对象
     */
    async create(createTaskViewObject: CreateTaskViewObject): GoAsync<TaskViewObject> {
        // 数据转换
        const createTaskValueObject = createTaskViewObjectToValueObject(createTaskViewObject)
        // 创建任务
        const [taskEntity, err] = await this.taskRepo.create(createTaskValueObject)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务列表
        this.taskStore.addTask(taskViewObject)
        // 返回任务视图对象
        return [taskViewObject, null]
    }

    /**
     * 更新任务
     * @param id 任务ID
     * @param updateViewObject 更新任务视图对象
     * @returns 错误信息
     */
    async update(id: TaskViewObject['id'], updateViewObject: UpdateTaskViewObject): GoAsync<void> {
        // 获取原始数据
        // const oldTask = this.taskStore.getTask(id)
        // const newTask = { name: oldTask?.name || undefined, ...updateViewObject }
        // 数据转换
        const updateTaskValueObject = updateTaskViewObjectToValueObject(id, updateViewObject)
        // 更新任务
        const updateError = await this.taskRepo.update(id, updateTaskValueObject)
        if (updateError !== null) return updateError
        // 更新内存数据（根据 givenUpAt 计算 isGivenUp）
        const storeUpdateData = { ...updateViewObject }
        if (storeUpdateData.givenUpAt !== undefined) {
            storeUpdateData.isGivenUp = dayjs(storeUpdateData.givenUpAt).isValid()
        }
        this.taskStore.updateTask(id, storeUpdateData)
        // 返回成功
        return null
    }

    /**
     * 复制任务
     * @param id 任务ID
     * @returns 任务视图对象
     */
    async copy(id: TaskViewObject['id']): GoAsync<TaskViewObject> {
        // 复制
        const [taskEntity, err] = await this.taskRepo.copy(id)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务列表
        this.taskStore.addTask(taskViewObject)
        // 返回任务视图对象
        return [taskViewObject, null]
    }

    /**
     * 稍后提醒
     * @param id 任务ID
     * @param durationMinutes 延迟分钟数（1-1440）
     * @returns 新的提醒时间
     */
    async snooze(id: TaskViewObject['id'], durationMinutes: number): GoAsync<void> {
        // 判断数据是否合法
        if (durationMinutes < 1 || durationMinutes > 1440) return '延迟时间需在 1-1440 分钟之间'
        // 执行延迟提醒
        const [newRemindAt, err] = await this.taskRepo.snooze(id, durationMinutes)
        if (err !== null) return err
        // 更新本地数据
        this.taskStore.updateTask(id, { remindAt: newRemindAt })
        // 返回
        return null
    }
}

/**
 * 创建任务用例
 * @param taskStore 任务存储实现
 * @param taskCheckItemStore 任务检查项存储实现
 * @param taskCommentStore 任务评论存储实现
 * @returns TaskUseCase 实例
 */
// export const newTaskUseCase = (taskStore: TaskStore) => {
//     const requester = getRequesterImpl()
//     const taskRepo = newTaskRepository(requester)
//     const taskCheckItemRepo = newTaskCheckItemRepository(requester)
//     const taskCommentRepo = newTaskCommentRepository(requester)
//     const taskDomain = new TaskDomain(taskRepo, taskCheckItemRepo, taskCommentRepo)
//     return new TaskUseCase(taskDomain, taskRepo, taskStore)
// }
