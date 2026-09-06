import type { GoAsync } from '@nao-todo/shared/types'
import type { TaskCheckItemEntity } from '../entities'
import type {
    CreateTaskCheckItemValueObject,
    UpdateTaskCheckItemValueObject
} from '../valueobjects'

/**
 * TaskCheckItemRepository 任务检查项仓库接口
 * @description 任务检查项仓库接口，定义了任务检查项的CRUD操作
 */
export interface TaskCheckItemRepository {
    /**
     * 获取任务检查项详情
     * @param id 任务检查项ID
     * @returns 任务检查项实体
     */
    get(id: string): GoAsync<TaskCheckItemEntity>

    /**
     * 创建任务检查项
     * @param createVO 创建任务检查项值对象
     * @returns 任务检查项实体
     */
    create(createVO: CreateTaskCheckItemValueObject): GoAsync<TaskCheckItemEntity>

    /**
     * 更新任务检查项
     * @param id 任务检查项ID
     * @param updateVO 更新任务检查项值对象
     * @returns 更新结果
     */
    update(id: string, updateVO: UpdateTaskCheckItemValueObject): GoAsync<void>

    /**
     * 删除任务检查项
     * @param id 任务检查项ID
     * @returns 删除结果
     */
    delete(id: string): GoAsync<void>

    /**
     * 查询所有任务检查项
     * @param taskId 任务ID
     * @returns 任务检查项实体列表
     */
    list(taskId: string): GoAsync<TaskCheckItemEntity[]>

    /**
     * 批量更新任务检查项
     * @param taskCheckItemEntities 任务检查项实体列表
     * @returns 更新计数 + 更新结果列表
     */
    batchUpdate(updateVOs: UpdateTaskCheckItemValueObject[]): GoAsync<TaskCheckItemEntity[]>
}