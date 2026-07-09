import {
    CreatePomodoroValueObject,
    PomodoroEntity,
    PomodoroRepository,
    UpdatePomodoroValueObject
} from '@nao-todo/domain/pomodoro'
import { Requester } from '../../requester'
import { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { getJWTFromLocalStorage } from '../utils'
import { CreatePomodoroRes, ListPomodoroRes, PomodoroRes, ResponseData } from '../models'
import {
    createPomodoroRes2Entity,
    createPomodoroValueObject2Req,
    ListPomodoroRes2Entities,
    pomodoroRes2Entity,
    UpdatePomodoroValueObject2Req
} from './converters'

/**
 * 番茄专注操作仓库实现类
 */
export class PomodoroRepoImpl implements PomodoroRepository {
    /**
     * 构造函数
     * @param requester 请求器实例
     */
    constructor(private requester: Requester) {}

    /**
     * 获取番茄专注
     * @param id 番茄专注ID
     * @returns 获取结果专注实体
     */
    async get(id: string): GoAsync<PomodoroEntity> {
        const response = await this.requester.get(`/pomodoros/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        if (res.code !== 70040) {
            return [null, res.message]
        }
        return [pomodoroRes2Entity(res.data as PomodoroRes), null]
    }

    /**
     * 创建番茄专注
     * @param createVO 创建番茄专注值对象
     * @returns 创建结果专注实体
     */
    async create(createVO: CreatePomodoroValueObject): GoAsync<PomodoroEntity> {
        const createRto = createPomodoroValueObject2Req(createVO)
        const response = await this.requester.post('/pomodoros/', createRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        if (res.code !== 70050) {
            return [null, res.message]
        }
        return [createPomodoroRes2Entity(res.data as CreatePomodoroRes), null]
    }

    /**
     * 更新番茄专注
     * @param updateVO 更新番茄专注值对象
     * @returns 更新结果专注实体
     */
    async update(updateVO: UpdatePomodoroValueObject): GoAsync<void> {
        const updateRto = UpdatePomodoroValueObject2Req(updateVO)
        const response = await this.requester.put(`/pomodoros/${updateVO.id}`, updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        return res.code !== 70060 ? res.message : null
    }

    /**
     * 删除番茄专注
     * @param id 番茄专注ID
     * @returns 删除结果
     */
    async delete(id: string): GoAsync<void> {
        const response = await this.requester.delete(`/pomodoros/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        return res.code !== 70100 ? res.message : null
    }

    /**
     * 归档番茄专注
     * @param id 番茄专注ID
     * @returns 归档结果
     */
    async archived(id: string): GoAsync<void> {
        const response = await this.requester.put(`/pomodoros/${id}/archived`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        return res.code !== 70070 ? res.message : null
    }

    /**
     * 取消归档番茄专注
     * @param id 番茄专注ID
     * @returns 取消归档结果
     */
    async unarchived(id: string): GoAsync<void> {
        const response = await this.requester.put(`/pomodoros/${id}/unarchived`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        return res.code !== 70080 ? res.message : null
    }

    /**
     * 获取番茄专注列表
     * @param queryString 查询字符串
     * @returns 番茄专注实体列表和分页信息
     */
    async list(
        queryString?: string
    ): GoAsync<{ pomodoroEntities: PomodoroEntity[]; pagination?: ResponseDataPagination }> {
        const response = await this.requester.get(`/pomodoros/?${queryString ?? ''}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as ResponseData
        if (res.code !== 70090) {
            return [null, res.message]
        }
        return [
            {
                pomodoroEntities: ListPomodoroRes2Entities(res.data as ListPomodoroRes),
                pagination: res.pagination
            },
            null
        ]
    }
}

/**
 * 创建番茄专注操作仓库实例
 * @param requester 请求器
 * @returns 番茄专注操作仓库实例
 */
export const newPomodoroRepository = (requester: Requester) => {
    return new PomodoroRepoImpl(requester)
}


