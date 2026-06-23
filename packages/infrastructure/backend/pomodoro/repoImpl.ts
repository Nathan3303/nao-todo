import { createPomodoroRes2Entity, createPomodoroValueObjectToReq, listPomodoroRes2Entities } from './converters'
import type { Requester } from '../../requester/types'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import type { CreatePomodoroReq, CreatePomodoroRes, ListPomodoroRes, ResponseData } from '../types'
import { CreatePomodoroRecordValueObject, PomodoroRecordEntity, type PomodoroRecordRepository } from '@nao-todo/domain/pomodoro'

/**
 * Pomodoro 记录仓库实现（后端 API）
 * @param requester HTTP 请求器
 * @returns PomodoroRecordRepository
 */
export const usePomodoroRecordRepository = (requester: Requester): PomodoroRecordRepository => {
    /**
     * 创建 Pomodoro 记录
     * @param valueObject 创建记录值对象
     * @returns Pomodoro 记录实体
     */
    const create = async (
        valueObject: CreatePomodoroRecordValueObject
    ): GoAsync<PomodoroRecordEntity> => {
        // 1. 构建请求传输对象
        const rto: CreatePomodoroReq = createPomodoroValueObjectToReq(valueObject)

        // 2. 调用接口
        const response = await requester.post('/pomodoros/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })

        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 70010) {
            return [null, res.message]
        }

        // 4. 转换为实体
        const entity = createPomodoroRes2Entity(res.data as CreatePomodoroRes)

        // 5. 返回
        return [entity, null]
    }

    /**
     * 获取 Pomodoro 记录列表
     * @param queryString 查询字符串
     * @returns Pomodoro 记录实体列表和分页信息
     */
    const list = async (
        queryString?: string
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }> => {
        // 1. 调用接口
        const response = await requester.get(`/pomodoros/?${queryString ?? ''}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })

        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 70030) {
            return [null, res.message]
        }

        // 3. 转换为实体
        const entities = listPomodoroRes2Entities(res.data as ListPomodoroRes)

        // 4. 返回
        return [{ entities, pagination: res.pagination }, null]
    }

    return { create, list }
}
