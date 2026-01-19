import parseObject2QueryString from '@nao-todo/infrastructure/utils/query-string-parser'
import { TaskEntity } from './entities'
import type { TaskRepository } from './repositories'
import type { CreateTask, GetTasksOptions, GoAsync, ResponseDataPagination } from '@nao-todo/types'

export class TaskDomain {
    /**
     * 任务领域服务
     * @param taskRepo 任务仓库
     */
    constructor(private taskRepo: TaskRepository) {}

    /**
     * 获取任务详情
     * @param taskId 任务ID
     * @returns 任务实体
     */
    async get(taskId: string): GoAsync<TaskEntity> {
        return await this.taskRepo.get(taskId)
    }

    /**
     * 创建任务
     * @param createVO 创建任务值对象
     * @returns 任务实体
     */
    async create(createVO: CreateTask): GoAsync<TaskEntity> {
        return await this.taskRepo.create(createVO)
    }

    /**
     * 更新任务
     * @param taskId 任务ID
     * @param taskEntity 任务实体
     * @returns 更新后的任务ID
     */
    async update(taskId: string, taskEntity: TaskEntity): GoAsync<string> {
        return await this.taskRepo.update(taskId, taskEntity)
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 无返回值
     */
    async remove(taskId: string): GoAsync<void> {
        return await this.taskRepo.remove(taskId)
    }

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 无返回值
     */
    async restore(taskId: string): GoAsync<void> {
        return await this.taskRepo.restore(taskId)
    }

    /**
     * 获取任务列表
     * @param listOptions 查询选项
     * @returns 任务实体列表
     */
    async list(
        listOptions?: GetTasksOptions
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 转换查询选项
        const queryString = parseObject2QueryString<GetTasksOptions>(
            listOptions || {},
            (key, value) => {
                if (key !== 'sort') return
                const sortValue = value as GetTasksOptions['sort']
                if (!sortValue?.field) return void 0
                return `${key}=${sortValue.field}:${sortValue.order}`
            }
        )
        // 2. 调用仓库方法
        return await this.taskRepo.list(queryString)
    }
}
