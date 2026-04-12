import { TaskDomain } from '@nao-todo/domain/task'
import type { GoAsync, ResponseDataPagination, TaskViewObject } from '@nao-todo/types'
import type {
    CreateTaskViewObject,
    GetTasksOptions,
    Task,
    UpdateTaskViewObject
} from '@nao-todo/types'
import {
    createTaskViewObjectToValueObject,
    taskEntitiesToViewObjects,
    taskEntityToViewObject,
    updateTaskViewObjectToValueObject
} from '../converters/task'

export interface TaskStore {
    setTasks(tasks: TaskViewObject[]): void
    updateTask(taskId: TaskViewObject['id'], updateTaskViewObject: UpdateTaskViewObject): void
    addTask(task: TaskViewObject): void
    getTask(taskId: TaskViewObject['id']): TaskViewObject | undefined
}

export class TaskUseCase {
    /**
     * 任务用例
     * @param taskDomain 任务领域服务
     * @param store 任务用例存储
     */
    constructor(
        private taskDomain: TaskDomain,
        private store: TaskStore
    ) {}

    /**
     * 加载任务列表
     * @param getTasksOptions 获取任务选项
     * @returns 任务ID列表
     */
    async loadTasks(getTasksOptions: GetTasksOptions): GoAsync<{
        taskIds: Task['id'][]
        pagination: ResponseDataPagination | undefined
    }> {
        // 获取任务实体列表
        const [listResult, err] = await this.taskDomain.list(getTasksOptions)
        if (err !== null) return [null, err]
        // 结构请求结果
        const { taskEntities, pagination } = listResult
        // 实体转换为视图对象
        const taskViewObjects = taskEntitiesToViewObjects(taskEntities)
        // 存储任务列表
        this.store.setTasks(taskViewObjects)
        // 返回任务ID列表
        return [{ taskIds: taskViewObjects.map((task) => task.id), pagination }, null]
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    async removeTask(taskId: Task['id']): GoAsync<void> {
        // 删除任务
        const err = await this.taskDomain.remove(taskId)
        if (err !== null) return err
        // 更新任务状态为已删除
        this.store.updateTask(taskId, { isDeleted: true })
        // 返回成功
        return null
    }

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    async restoreTask(taskId: Task['id']): GoAsync<void> {
        // 恢复
        const err = await this.taskDomain.restore(taskId)
        if (err !== null) return err
        // 更新任务状态为未删除
        this.store.updateTask(taskId, { isDeleted: false })
        // 返回成功
        return null
    }

    /**
     * 创建任务
     * @param createTaskViewObject 创建任务视图对象
     * @returns 任务视图对象
     */
    async createTask(createTaskViewObject: CreateTaskViewObject): GoAsync<TaskViewObject> {
        // 数据转换
        const createTaskValueObject = createTaskViewObjectToValueObject(createTaskViewObject)
        // 创建任务
        const [taskEntity, err] = await this.taskDomain.create(createTaskValueObject)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务列表
        this.store.addTask(taskViewObject)
        // 返回任务视图对象
        return [taskViewObject, null]
    }

    /**
     * 更新任务
     * @param taskId 任务ID
     * @param updateTaskViewObject 更新任务视图对象
     * @returns 错误信息
     */
    async updateTask(
        taskId: Task['id'],
        updateTaskViewObject: UpdateTaskViewObject
    ): GoAsync<void> {
        // 获取原始数据
        const oldTask = this.store.getTask(taskId)
        const newTask = { name: oldTask?.name || undefined, ...updateTaskViewObject }
        // console.log(newTask)
        // 数据转换
        const updateTaskValueObject = updateTaskViewObjectToValueObject(taskId, newTask)
        // 更新任务
        const [, err] = await this.taskDomain.update(taskId, updateTaskValueObject)
        if (err !== null) return err
        // 更新内存数据
        this.store.updateTask(taskId, updateTaskViewObject)
        // 返回成功
        return null
    }
}

