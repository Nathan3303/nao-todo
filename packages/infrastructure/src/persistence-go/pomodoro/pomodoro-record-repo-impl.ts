import {
    createPomodoroRecordRes2Entity,
    createPomodoroRecordValueObjectToReq,
    listPomodoroRecordRes2Entities,
    pomodoroRecordRes2Entity
} from './converters'
import type { Requester, GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import type {
    CreatePomodoroRecordRes,
    ListPomodoroRecordRes,
    PomodoroRecordRes,
    ResponseData
} from '../models'
import {
    CreatePomodoroRecordValueObject,
    PomodoroRecordEntity,
    type PomodoroRecordRepository
} from '@nao-todo/domain-pomodoro'
import { getJWTFromLocalStorage } from '../utils'

/**
 * 番茄专注记录操作仓库实现
 */
export class PomodoroRecordRepoImpl implements PomodoroRecordRepository {
    /**
     * 番茄专注记录操作仓库构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * 获取番茄专注记录
     * @param id 记录ID
     * @returns 番茄专注记录实体
     */
    async get(id: string): GoAsync<PomodoroRecordEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/pomodoro-records/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 70020) {
            return [null, res.message]
        }
        // 4. 返回
        return [pomodoroRecordRes2Entity(res.data as PomodoroRecordRes), null]
    }

    /**
     * 创建番茄专注记录
     * @param createVO 创建记录值对象
     * @returns 番茄专注记录实体
     */
    async create(createVO: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity> {
        // 1. 构建请求传输对象
        const createRto = createPomodoroRecordValueObjectToReq(createVO)
        // 2. 调用接口
        const response = await this.requester.post('/pomodoro-records/', createRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 70010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const entity = createPomodoroRecordRes2Entity(res.data as CreatePomodoroRecordRes)
        // 5. 返回
        return [entity, null]
    }

    /**
     * 获取番茄专注记录列表
     * @param queryString 查询字符串
     * @returns 番茄专注记录实体列表 + 分页信息
     */
    async list(
        queryString?: string
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 调用接口
        const response = await this.requester.get(`/pomodoro-records/?${queryString ?? ''}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 70030) {
            return [null, res.message]
        }
        // 3. 返回
        return [
            {
                entities: listPomodoroRecordRes2Entities(res.data as ListPomodoroRecordRes),
                pagination: res.pagination
            },
            null
        ]
    }
}

/**
 * 创建番茄专注记录操作仓库实例
 * @param requester 请求器
 * @returns 番茄专注记录操作仓库实例
 */
export const newPomodoroRecordRepository = (requester: Requester) => {
    return new PomodoroRecordRepoImpl(requester)
}