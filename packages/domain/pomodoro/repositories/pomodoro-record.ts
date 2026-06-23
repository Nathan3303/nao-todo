import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { PomodoroRecordEntity } from '../entities'
import { CreatePomodoroRecordValueObject } from '../valueobjects'

/**
 * Pomodoro 记录仓库接口
 * @description 定义 Pomodoro 记录的持久化操作契约
 */
export interface PomodoroRecordRepository {
    /**
     * 创建 Pomodoro 记录
     * @param valueObject 创建记录值对象
     * @returns Pomodoro 记录实体
     */
    create(valueObject: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity>

    /**
     * 获取 Pomodoro 记录列表
     * @param queryString 查询字符串
     * @returns Pomodoro 记录实体列表和分页信息
     */
    list(
        queryString?: string
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }>
}
