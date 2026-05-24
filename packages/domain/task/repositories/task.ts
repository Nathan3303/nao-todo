import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { TaskEntity } from '../entities'
import { CreateTaskValueObject, UpdateTaskValueObject } from '../valueobjects'

/**
 * 任务仓库接口
 * @description 任务仓库接口，定义了任务的CRUD操作
 */
export interface TaskRepository {
    /**
     * 获取任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    get(taskId: string): GoAsync<TaskEntity>

    /**
     * 创建任务
     * @param createTaskValueObject 创建任务值对象
     * @returns 任务实体
     */
    create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity>

    /**
     * 更新任务
     * @param taskId 任务ID
     * @param updateTaskValueObject
     */
    update(taskId: string, updateTaskValueObject: UpdateTaskValueObject): GoAsync<string>

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    remove(taskId: string): GoAsync<void>

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 错误信息
     */
    restore(taskId: string): GoAsync<void>

    /**
     * 获取任务列表
     * @param queryString 查询字符串
     * @returns 任务实体列表和分页信息
     */
    list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>

    /**
     * 复制任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    copy(taskId: string): GoAsync<TaskEntity>

    /**
     * 稍后提醒
     * @param taskId 任务ID
     * @param durationMinutes 延迟分钟数（1-1440）
     * @returns 新的提醒时间
     */
    snooze(taskId: string, durationMinutes: number): GoAsync<string>
}

