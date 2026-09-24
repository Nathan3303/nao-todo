import type { GoAsync, Pagination } from '@nao-todo/shared/types'
import { TaskEntity } from '../entities'
import { CreateTaskValueObject, UpdateTaskValueObject } from '../valueobjects'

/**
 * TaskRepository 任务仓库接口
 * @description 任务仓库接口，定义了任务的CRUD操作
 */
export interface TaskRepository {
    /**
     * get 获取任务
     * @param id 任务ID
     * @returns 任务实体
     */
    get(id: string): GoAsync<TaskEntity>

    /**
     * create 创建任务
     * @param createVO 创建任务值对象
     * @returns 任务实体
     */
    create(createVO: CreateTaskValueObject): GoAsync<TaskEntity>

    /**
     * update 更新任务
     * @param id 任务ID
     * @param updateVO 更新任务值对象
     * @returns 更新错误信息
     */
    update(id: string, updateVO: UpdateTaskValueObject): GoAsync<void>

    /**
     * remove 删除任务
     * @param id 任务ID
     * @returns 错误信息
     */
    remove(id: string): GoAsync<void>

    /**
     * restore 恢复任务
     * @param id 任务ID
     * @returns 错误信息
     */
    restore(id: string): GoAsync<void>

    /**
     * archiveByProjectId 归档清单下「未删除且未归档」的任务（批量级联）
     * @description 可选方法 ⇒ 远端/mobile 实现不必提供；调用方以 `typeof === 'function'` 守卫。
     *              本地实现与清单行写入在**同一 Dexie `rw` 事务**内完成
     *              （ADR `2026-09-24-project-archive.md` §4 Q1 / PA-5）。
     */
    archiveByProjectId?(projectId: string): GoAsync<void>

    /**
     * unarchiveByProjectId 恢复清单下「未删除且仍归档」的任务（批量级联）
     * @description 同 `archiveByProjectId`（可选 + 同事务）
     */
    unarchiveByProjectId?(projectId: string): GoAsync<void>

    /**
     * list 获取任务列表
     * @param queryString 查询字符串
     * @returns 任务实体列表和分页信息
     */
    list(queryString?: string): GoAsync<{ taskEntities: TaskEntity[]; pagination?: Pagination }>

    /**
     * copy 复制任务
     * @param id 任务ID
     * @returns 任务实体
     */
    copy(id: string): GoAsync<TaskEntity>

    /**
     * snooze 稍后提醒
     * @param id 任务ID
     * @param durationMinutes 延迟分钟数（1-1440）
     * @returns 新的提醒时间
     */
    snooze(id: string, durationMinutes: number): GoAsync<string>
}