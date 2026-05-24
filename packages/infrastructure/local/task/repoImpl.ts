import { CreateTaskValueObject, TaskEntity, UpdateTaskValueObject } from '@nao-todo/domain/task'
import type { LocalTaskRepository } from '@nao-todo/domain/task/repositories'
import type { LocalDB } from '../db'
import { GetTasksOptions, GoAsync, ResponseDataPagination, TaskModel } from '@nao-todo/types'
import {
    buildListQuery,
    createTaskValueObjectToModel,
    taskModelToEntity,
    updateTaskValueObjectToPartialModel
} from './converters'
import dayjs from 'dayjs'

/**
 * 本地任务仓库实现类
 * @description 本地任务仓库实现类，用于处理任务的本地数据操作。
 */
export class LocalTaskRepositoryImpl implements LocalTaskRepository {
    /**
     * 本地任务仓库实现类构造函数
     * @description 初始化本地任务仓库实现类实例。
     * @param localDB 本地数据库实例
     */
    constructor(private localDB: LocalDB) {}

    /**
     * 创建任务
     * @param createTaskValueObject 创建任务值对象
     * @returns 任务实体
     */
    async create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity> {
        try {
            // 转换为存储模型
            const localTaskModel = createTaskValueObjectToModel(createTaskValueObject)
            // 保存到数据库
            await this.localDB.tasks.add(localTaskModel)
            // 转换为实体
            const taskEntity = taskModelToEntity(localTaskModel)
            // 返回实体
            return [taskEntity, null]
        } catch (error) {
            console.error(error)
            return [null, '创建任务失败']
        }
    }

    /**
     * 删除任务（硬删除）
     * @param taskId 任务ID，通常是 uuid
     * @returns 无
     */
    async delete(taskId: string): GoAsync<void> {
        try {
            // 删除任务
            await this.localDB.tasks.where('id').equals(taskId).delete()
            // 返回
            return null
        } catch (error) {
            console.error(error)
            return '删除任务失败'
        }
    }

    /**
     * 更新任务
     * @description 更新任务，根据任务ID和更新任务值对象，将任务值对象转换为存储模型，然后更新数据库中的任务。
     * @param taskId 任务ID，通常是 uuid
     * @param updateTaskValueObject 更新任务值对象
     * @returns 任务ID
     */
    async update(taskId: string, updateTaskValueObject: UpdateTaskValueObject): GoAsync<string> {
        // 转换为存储模型
        const updatingModel = updateTaskValueObjectToPartialModel(updateTaskValueObject)
        // 更新数据库
        try {
            console.log(taskId, updatingModel)
            const rows = await this.localDB.tasks.where('_id').equals(taskId).modify(updatingModel)
            // 检查是否更新成功
            if (rows === 0) return [null, '任务不存在']
            // 返回任务ID
            return [taskId, null]
        } catch (error) {
            console.error(error)
            return [null, '更新任务失败']
        }
    }

    /**
     * 删除任务（软删除）
     * @param taskId 任务ID，通常是 uuid
     * @returns 无
     */
    async remove(taskId: string): GoAsync<void> {
        try {
            // 删除任务
            await this.localDB.tasks
                .where('id')
                .equals(taskId)
                .modify({ _deletedAt: dayjs().toISOString() })
            // 返回
            return null
        } catch (error) {
            console.error(error)
            return '删除任务失败'
        }
    }

    /**
     * 恢复任务（软删除）
     * @param taskId 任务ID，通常是 uuid
     * @returns 无
     */
    async restore(taskId: string): GoAsync<void> {
        try {
            // 恢复任务
            await this.localDB.tasks.where('id').equals(taskId).modify({ _deletedAt: null })
            // 返回
            return null
        } catch (error) {
            console.error(error)
            return '恢复任务失败'
        }
    }

    /**
     * 查询任务
     * @param taskId 任务ID，通常是 uuid
     * @returns 任务实体
     */
    async get(taskId: string): GoAsync<TaskEntity> {
        try {
            // 查询任务
            const taskModel = await this.localDB.tasks.where('id').equals(taskId).first()
            if (!taskModel) return [null, '任务不存在']
            // 转换为实体
            const taskEntity = taskModelToEntity(taskModel)
            // 返回实体
            return [taskEntity, null]
        } catch (error) {
            console.error(error)
            return [null, '查询任务失败']
        }
    }

    /**
     * 查询所有任务
     * @param queryString 查询字符串，用于筛选任务
     * @returns 任务实体列表和分页信息
     */
    async list(
        userId: string,
        getOptions: GetTasksOptions
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        // 填充默认值
        getOptions.page = getOptions.page || 1
        getOptions.limit = getOptions.limit || 20
        getOptions.sort = getOptions.sort || { field: '_createdAt', order: 'desc' }
        // 构建查询条件
        const query = buildListQuery(this.localDB, userId, getOptions)
        // 构建空列表和分页信息
        let taskModels = [] as TaskModel[]
        const pagination = {} as ResponseDataPagination
        // 查询数据
        // console.log('---', userId, getOptions)
        try {
            taskModels = await query.toArray()
            pagination.total = await query.count()
        } catch (error) {
            console.error(error)
            return [null, '查询任务失败']
        }
        // 转换为实体列表
        const taskEntities = taskModels.map(taskModelToEntity)
        // 计算分页信息
        pagination.page = getOptions.page
        pagination.limit = getOptions.limit
        pagination.maxPage = Math.ceil(pagination.total / pagination.limit)
        // 返回实体列表和分页信息
        return [{ taskEntities, pagination }, null]
    }
}

