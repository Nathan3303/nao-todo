import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import { PomodoroRecordEntity } from '../entities'
import { CreatePomodoroRecordValueObject } from '../valueobjects'

/**
 * 番茄专注记录仓库接口
 * @description 定义番茄专注记录的持久化操作
 */
export interface PomodoroRecordRepository {
    /**
     * 获取番茄专注记录
     * @param id 专注记录 ID
     * @returns 番茄专注记录实体
     */
    get(id: string): GoAsync<PomodoroRecordEntity>

    /**
     * 创建番茄专注记录
     * @param createVO 创建值对象
     * @returns 番茄专注记录实体
     */
    create(createVO: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity>

    /**
     * 获取番茄专注记录列表
     * @param queryString 查询字符串
     * @returns 番茄专注记录实体列表和分页信息
     */
    list(
        queryString?: string
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }>
}