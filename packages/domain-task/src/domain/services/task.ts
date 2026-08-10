// import { TaskCheckItemRepository } from '../repositories/task-check-item'
// import { TaskCommentRepository } from '../repositories/task-comment'
import type { TaskRepository } from '../repositories/task'
import type { TaskEntity } from '../entities/task'
import type { UpdateTaskValueObject } from '../valueobjects/update-task'
import type { GoAsync, ResponseDataPagination, QueryOptionsValueObject } from '@nao-todo/shared'

/**
 * 任务领域服务
 * @description 当前仅承载「查询选项 → 仓储查询串」的转换。
 *              跨实体的业务规则（如父子任务状态联动）后续在此扩展。
 * @todo 若长期无跨实体规则，考虑与 TaskRepository 合并
 */
export class TaskDomain {
    /**
     * 任务领域服务构造函数
     * @param taskRepo 任务仓库实例
     */
    constructor(
        private taskRepo: TaskRepository
        // private taskCheckItemRepo: TaskCheckItemRepository,
        // private taskCommentRepo: TaskCommentRepository
    ) {}

    /**
     * listTasks 获取任务列表
     * @param listOptions 查询选项
     * @returns 任务实体列表
     */
    async listTasks(
        listOptions: QueryOptionsValueObject
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 转换查询选项
        const queryString = listOptions.toString((key, value) => {
            if (key !== 'sort') return
            const sortValue = value as { field: string; order: string }
            if (!sortValue?.field) return
            return `${sortValue.field}:${sortValue.order}`
        })
        // 2. 调用仓库方法
        return await this.taskRepo.list(queryString)
    }

    /**
     * batchUpdate 批量更新任务
     * @description 后端暂无任务批量更新接口，先采用 for 方式逐个调用仓储更新；
     *              单条失败不中断，返回成功条数。待后端支持批量接口后切换为仓储批量方法。
     * @param updateTaskValueObjects 更新任务值对象列表（每个携带任务 ID）
     * @returns 成功更新的任务数量
     */
    async batchUpdate(updateTaskValueObjects: UpdateTaskValueObject[]): GoAsync<number> {
        let succeeded = 0
        for (const updateVO of updateTaskValueObjects) {
            const err = await this.taskRepo.update(updateVO.id, updateVO)
            if (err === null) succeeded++
        }
        return [succeeded, null]
    }
}