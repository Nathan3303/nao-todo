import { GetTasksOptions, GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { TaskEntity } from '../entities/task'
import { CreateTaskValueObject } from '../valueobjects/create-task'
import { UpdateTaskValueObject } from '../valueobjects/update-task'

/**
 * 本地任务仓库接口
 * @description 本地任务仓库接口，定义了本地任务的CRUD操作
 */
export interface LocalTaskRepository {
    /**
     * 创建任务
     * @param createTaskValueObject 创建任务值对象
     * @returns 任务实体
     */
    create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity>

    /**
     * 删除任务（硬删除）
     * @param taskId 任务ID，通常是 uuid
     * @returns 无
     */
    delete(taskId: string): GoAsync<void>

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
     * 获取任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    get(taskId: string): GoAsync<TaskEntity>

    /**
     * 查询所有任务
     * @param userId 用户ID，通常是 uuid
     * @param getOptions 查询选项，用于筛选任务
     * @returns 任务实体列表和分页信息
     */
    list(
        userId: string,
        getOptions?: GetTasksOptions
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>
}

