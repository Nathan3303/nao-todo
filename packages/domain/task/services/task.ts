import { TaskCheckItemRepository } from '../repositories/task-check-item'
import { TaskCommentRepository } from '../repositories/task-comment'
import { QueryOptionsValueObject } from '../../shares/valueobjects/query-options'
import type { TaskRepository } from '../repositories/task'
import type { TaskEntity } from '../entities/task'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'

/**
 * 任务领域服务
 * @description 任务领域服务类，用于处理任务的业务逻辑和数据操作。
 */
export class TaskDomain {
    /**
     * 任务领域服务构造函数
     * @param taskRepo 任务仓库实例
     */
    constructor(
        private taskRepo: TaskRepository,
        private taskCheckItemRepo: TaskCheckItemRepository,
        private taskCommentRepo: TaskCommentRepository
    ) {}

    /**
     * listTasks 获取任务列表
     * @param listOptions 查询选项
     * @returns 任务实体列表
     */
    async listTasks(
        listOptions?: QueryOptionsValueObject
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 转换查询选项
        const queryOptionsVO = new QueryOptionsValueObject(listOptions || {})
        const queryString = queryOptionsVO.toString((key, value) => {
            if (key !== 'sort') return
            const sortValue = value as { field: string; order: string }
            if (!sortValue?.field) return void 0
            return `${sortValue.field}:${sortValue.order}`
        })
        // 2. 调用仓库方法
        return await this.taskRepo.list(queryString)
    }
}

