// import { TaskCheckItemRepository } from '../repositories/task-check-item'
// import { TaskCommentRepository } from '../repositories/task-comment'
import type { TaskRepository } from '../repositories/task'
import { isStarMarkedBy, type TaskEntity } from '../entities/task'
import type { UpdateTaskValueObject } from '../valueobjects/update-task'
import type { GoAsync, ResponseDataPagination, QueryOptionsValueObject } from '@nao-todo/shared'

// 批量更新结果
export type TaskBatchUpdateResult = {
    succeeded: number
    failedIds: string[]
}

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
     *              每条先加载实体走行为方法（星标/时间边界等领域规则），失败不中断；
     *              待后端支持批量接口后切换为仓储批量方法。
     * @param updateTaskValueObjects 更新任务值对象列表（每个携带任务 ID）
     * @returns 成功更新的任务数量与失败的任务 ID 列表
     */
    async batchUpdate(
        updateTaskValueObjects: UpdateTaskValueObject[]
    ): GoAsync<TaskBatchUpdateResult> {
        const failedIds: string[] = []
        for (const updateVO of updateTaskValueObjects) {
            // 1. 加载实体并走行为方法（领域规则校验）
            const [entity, getError] = await this.taskRepo.get(updateVO.id)
            if (getError !== null || !entity) {
                failedIds.push(updateVO.id)
                continue
            }
            if (updateVO.starMarkAt !== undefined) {
                const starError = isStarMarkedBy(updateVO.starMarkAt)
                    ? entity.star()
                    : entity.unstar()
                if (starError !== null) {
                    failedIds.push(updateVO.id)
                    continue
                }
                updateVO.starMarkAt = entity.starMarkAt
            }
            if (updateVO.startAt !== undefined || updateVO.endAt !== undefined) {
                const scheduleError = entity.updateSchedule(updateVO.startAt, updateVO.endAt)
                if (scheduleError !== null) {
                    failedIds.push(updateVO.id)
                    continue
                }
                if (updateVO.startAt !== undefined)
                    updateVO.startAt = entity.startAt === '' ? null : entity.startAt
                if (updateVO.endAt !== undefined)
                    updateVO.endAt = entity.endAt === '' ? null : entity.endAt
            }
            // 2. 逐条更新
            const updateError = await this.taskRepo.update(updateVO.id, updateVO)
            if (updateError !== null) failedIds.push(updateVO.id)
        }
        return [{ succeeded: updateTaskValueObjects.length - failedIds.length, failedIds }, null]
    }
}