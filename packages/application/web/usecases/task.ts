import { TaskDomain } from '@nao-todo/domain/task'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import type { CreateTask, GetTasksOptions, Task, UpdateTaskOptions } from '@nao-todo/types'
import { taskEntity2ViewObject } from '../converters/task'

export interface TaskStore {
    setTasks(tasks: Task[]): void
    updateTask(taskId: Task['id'], updateOptions: UpdateTaskOptions): void
    addTask(task: Task): void
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
        // 1. 从领域服务获取任务列表
        const [res, err] = await this.taskDomain.list(getTasksOptions)
        if (err !== null) {
            return [null, err]
        }
        // 2. 转换为视图对象
        const tasks = res.taskEntities.map(taskEntity2ViewObject)
        // 3. 存储任务列表
        this.store.setTasks(tasks)
        // 4. 返回任务ID列表
        return [{ taskIds: tasks.map((task) => task.id), pagination: res.pagination }, null]
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    async removeTask(taskId: Task['id']): GoAsync<void> {
        // 1. 从领域服务删除任务
        const err = await this.taskDomain.remove(taskId)
        if (err !== null) {
            return err
        }
        // 2. 更新任务列表
        this.store.updateTask(taskId, { isDeleted: true })
        return null
    }

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    async restoreTask(taskId: Task['id']): GoAsync<void> {
        // 1. 从领域服务恢复任务
        const err = await this.taskDomain.restore(taskId)
        if (err !== null) {
            return err
        }
        // 2. 更新任务列表
        this.store.updateTask(taskId, { isDeleted: false })
        return null
    }

    /**
     * 创建任务
     * @param task 创建任务选项
     * @returns 任务视图对象
     */
    async createTask(task: CreateTask): GoAsync<Task> {
        // 1. 从领域服务创建任务
        const [taskEntity, err] = await this.taskDomain.create(task)
        if (err !== null) {
            return [null, err]
        }
        // 2. 转换为视图对象
        const taskVO = taskEntity2ViewObject(taskEntity)
        // 3. 存储任务列表
        this.store.addTask(taskVO)
        // 4. 返回任务ID列表
        return [taskVO, null]
    }
}
