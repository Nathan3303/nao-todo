import {
    CreateTaskCommentValueObject,
    TaskCommentEntity,
    TaskCommentRepository,
    UpdateTaskCommentValueObject
} from '@nao-todo/domain/task'
import type { GoAsync, Requester } from '@nao-todo/shared'
import { getJWTFromLocalStorage } from '../utils'
import {
    createTaskCommentRes2Entity,
    createTaskCommentValueObject2Req,
    listTaskCommentRes2Entities,
    taskCommentRes2Entity,
    updateTaskValueObject2Req
} from './converters'
import { CreateTaskCommentRes, ResponseData, TaskCommentRes } from '../models'

/**
 * 任务评论仓库实现类
 */
export class TaskCommentRepoImpl implements TaskCommentRepository {
    /**
     * 任务评论仓库实现类构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * get 获取任务评论
     * @param id 任务评论ID
     * @returns 任务评论实体
     */
    async get(id: string): GoAsync<TaskCommentEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/comments/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60000) {
            return [null, res.message]
        }
        // 3. 返回实体
        return [taskCommentRes2Entity(res.data as TaskCommentRes), null]
    }

    /**
     * create 创建任务评论
     * @param createVO 创建任务评论值对象
     * @returns 任务评论实体
     */
    async create(createVO: CreateTaskCommentValueObject): GoAsync<TaskCommentEntity> {
        // 1. 构建 rto
        const createRto = createTaskCommentValueObject2Req(createVO)
        // 2. 调用接口
        const response = await this.requester.post('/comments/', createRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60010) {
            return [null, res.message]
        }
        // 4. 返回实体
        return [createTaskCommentRes2Entity(res.data as CreateTaskCommentRes), null]
    }

    /**
     * update 更新任务评论
     * @param id 任务评论ID
     * @param updateVO 更新任务评论值对象
     * @returns 更新错误信息
     */
    async update(updateVO: UpdateTaskCommentValueObject): GoAsync<void> {
        // 1. 构建 rto
        const updateRto = updateTaskValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put(`/comments/${updateVO.id}`, updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60020) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * delete 删除任务评论
     * @param id 任务评论ID
     * @returns 错误信息
     */
    async delete(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.delete(`/comments/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * list 查询所有评论
     * @param taskId 任务ID
     * @returns 评论实体列表
     */
    async list(taskId: string): GoAsync<TaskCommentEntity[]> {
        // 1. 调用接口
        const response = await this.requester.get(`/comments/?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60040) {
            return [null, res.message]
        }
        // 3. 返回实体列表
        return [listTaskCommentRes2Entities(res.data as TaskCommentRes[]), null]
    }
}

/**
 * 创建任务评论仓库工厂方法
 * @param requester 请求器
 * @returns 任务评论仓库
 */
export const newTaskCommentRepository = (requester: Requester) => {
    return new TaskCommentRepoImpl(requester)
}