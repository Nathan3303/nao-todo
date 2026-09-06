import { QueryOptionsValueObject } from '@nao-todo/shared/valueobjects/query-options'
import type { GoAsync, Pagination } from '@nao-todo/shared/types'
import { PomodoroEntity, PomodoroRecordEntity } from '../entities'
import type { PomodoroRecordRepository, PomodoroRepository } from '../repositories'
import type { GetPomodoroRecordsOptions } from '../types'
import {
    CreatePomodoroRecordValueObject,
    ListPomodoroValueObject,
    UpdatePomodoroValueObject
} from '../valueobjects'

/**
 * Pomodoro 领域服务
 * @description 处理 Pomodoro 的业务逻辑
 */
export class PomodoroDomain {
    // constructor 构造函数
    constructor(
        private pomodoroRepo: PomodoroRepository, // 番茄专注仓库
        private pomodoroRecordRepo: PomodoroRecordRepository // 番茄专注记录仓库
    ) {}

    /**
     * 获取 Pomodoro 列表
     * @param listVO 查询值对象
     * @returns Pomodoro 实体列表和分页信息
     */
    async list(
        listVO: ListPomodoroValueObject
    ): GoAsync<{ pomodoroEntities: PomodoroEntity[]; pagination?: Pagination }> {
        // 1. 转换查询选项 -> 查询字符串
        const queryOptions = listVO.makeQueryOptions()
        const queryString = new QueryOptionsValueObject(queryOptions).toString()
        // 2. 调用仓库方法
        return await this.pomodoroRepo.list(queryString)
    }

    /**
     * 更新 Pomodoro
     * @param updateVO 更新值对象
     * @returns 错误信息
     */
    async update(updateVO: UpdatePomodoroValueObject): GoAsync<void> {
        const validateErr = updateVO.validate()
        if (validateErr !== null) return validateErr
        return await this.pomodoroRepo.update(updateVO)
    }

    /**
     * 创建 Pomodoro 记录
     * @param valueObject 创建记录值对象
     * @returns Pomodoro 记录实体
     */
    async createRecord(
        valueObject: CreatePomodoroRecordValueObject
    ): GoAsync<PomodoroRecordEntity> {
        const validateErr = valueObject.validate()
        if (validateErr !== null) {
            return [null, validateErr]
        }
        return await this.pomodoroRecordRepo.create(valueObject)
    }

    /**
     * 获取 Pomodoro 记录列表
     * @param listOptions 查询选项
     * @returns Pomodoro 记录实体列表和分页信息
     */
    async listRecord(
        listOptions?: GetPomodoroRecordsOptions
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: Pagination }> {
        // 1. 转换查询选项 -> 查询字符串
        const queryString = new QueryOptionsValueObject(listOptions || {}).toString()
        // 2. 调用仓库方法
        return await this.pomodoroRecordRepo.list(queryString)
    }
}