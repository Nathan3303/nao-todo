import { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import { PomodoroEntity } from '../entities'
import { CreatePomodoroValueObject, UpdatePomodoroValueObject } from '../valueobjects'

/**
 * 番茄专注操作仓库接口
 */
export interface PomodoroRepository {
    /**
     * 获取番茄专注
     * @param id 番茄专注ID
     * @returns 获取结果专注实体
     */
    get(id: string): GoAsync<PomodoroEntity>

    /**
     * 创建番茄专注
     * @param createVO 创建番茄专注值对象
     * @returns 创建结果专注实体
     */
    create(createVO: CreatePomodoroValueObject): GoAsync<PomodoroEntity>

    /**
     * 更新番茄专注
     * @param updateVO 更新番茄专注值对象
     * @returns 更新结果专注实体
     */
    update(updateVO: UpdatePomodoroValueObject): GoAsync<void>

    /**
     * 删除番茄专注
     * @param id 番茄专注ID
     * @returns 删除结果专注实体
     */
    delete(id: string): GoAsync<void>

    /**
     * 归档番茄专注
     * @param id 番茄专注ID
     * @returns 归档结果专注实体
     */
    archived(id: string): GoAsync<void>

    /**
     * 取消归档番茄专注
     * @param id 番茄专注ID
     * @returns 取消归档结果专注实体
     */
    unarchived(id: string): GoAsync<void>

    /**
     * 获取番茄专注列表
     * @param queryString 查询字符串
     * @returns 获取结果专注实体数组和分页信息
     */
    list(
        queryString?: string
    ): GoAsync<{ pomodoroEntities: PomodoroEntity[]; pagination?: ResponseDataPagination }>
}