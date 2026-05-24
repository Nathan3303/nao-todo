import { TaskEntity } from '../entities'
import { CreateTaskValueObject, UpdateTaskValueObject } from '../valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import type { LocalTaskRepository } from '../repositories'
import type { GetTasksOptions, GoAsync, ResponseDataPagination } from '@nao-todo/types'

/**
 * 本地数据库任务领域服务
 * @description 本地数据库任务领域服务类，用于处理任务的业务逻辑和数据操作。
 */
export class LocalTaskDomain {
    /**
     * 本地数据库任务领域服务构造函数
     * @param localTaskRepo 本地数据库任务仓库实例
     */
    constructor(private localTaskRepo: LocalTaskRepository) {}

    /**
     * 获取本地数据库任务详情
     * @param taskId 任务ID
     * @returns 任务实体
     */
    async get(taskId: string): GoAsync<TaskEntity> {
        return await this.localTaskRepo.get(taskId)
    }

    /**
     * 创建本地数据库任务
     * @param createTaskValueObject 创建任务值对象
     * @returns 任务实体
     */
    async create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity> {
        // 验证
        const validateErr = createTaskValueObject.validate()
        if (validateErr !== null) {
            console.log(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 创建
        return await this.localTaskRepo.create(createTaskValueObject)
    }

    /**
     * 更新本地数据库任务
     * @param taskId 任务ID
     * @param updateTaskValueObject 更新任务值对象
     * @returns 更新后的任务ID
     */
    async update(taskId: string, updateTaskValueObject: UpdateTaskValueObject): GoAsync<string> {
        // 验证
        const validateErr = updateTaskValueObject.validate()
        if (validateErr !== null) {
            console.log(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 更新
        return await this.localTaskRepo.update(taskId, updateTaskValueObject)
    }

    /**
     * 删除本地数据库任务
     * @param taskId 任务ID
     * @returns 无返回值
     */
    async remove(taskId: string): GoAsync<void> {
        return await this.localTaskRepo.remove(taskId)
    }

    /**
     * 恢复本地数据库任务
     * @param taskId 任务ID
     * @returns 无返回值
     */
    async restore(taskId: string): GoAsync<void> {
        return await this.localTaskRepo.restore(taskId)
    }

    /**
     * 获取本地数据库任务列表
     * @param listOptions 查询选项
     * @returns 任务实体列表 & 分页信息
     */
    async list(
        listOptions?: GetTasksOptions
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        return await this.localTaskRepo.list('', listOptions)
    }
}

