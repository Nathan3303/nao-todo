import { PomodoroDomain, PomodoroRecordRepository } from '@nao-todo/domain-pomodoro'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import type {
    CreatePomodoroRecordViewObject,
    GetPomodoroRecordsOptions,
    PomodoroRecordViewObject
} from '../viewobjects/pomodoro'
import type { PomodoroRecordStore } from '../stores'
import {
    createPomodoroRecordViewObjectToValueObject,
    pomodoroRecordEntitiesToViewObjects,
    pomodoroRecordEntityToViewObject
} from './converters'

/**
 * Pomodoro 记录用例
 */
export class PomodoroRecordUseCase {
    /**
     * Pomodoro 记录用例构造函数
     * @param domain 领域服务
     * @param repo 数据库仓库
     * @param store 存储
     */
    constructor(
        private domain: PomodoroDomain,
        private repo: PomodoroRecordRepository,
        private store: PomodoroRecordStore
    ) {}

    /**
     * 创建 Pomodoro 记录
     * @param createViewObject 创建记录视图对象
     * @returns 创建的 Pomodoro 记录视图对象
     */
    async createRecord(
        createViewObject: CreatePomodoroRecordViewObject
    ): GoAsync<PomodoroRecordViewObject> {
        const valueObject = createPomodoroRecordViewObjectToValueObject(createViewObject)
        const [entity, err] = await this.repo.create(valueObject)
        if (err !== null) return [null, err]
        const viewObject = pomodoroRecordEntityToViewObject(entity)
        this.store.addRecord(viewObject)
        return [viewObject, null]
    }

    /**
     * 获取 Pomodoro 记录列表
     * @param options 查询选项
     * @returns 记录 ID 列表和分页信息
     */
    async getRecords(
        options: GetPomodoroRecordsOptions
    ): GoAsync<{ recordIds: string[]; pagination?: ResponseDataPagination }> {
        // 1. 调用领域服务
        const [result, err] = await this.domain.listRecord(options)
        if (err !== null) return [null, err]
        // 2. 实体 → 视图对象
        const viewObjects = pomodoroRecordEntitiesToViewObjects(result.entities)
        // 3. 存储记录列表
        this.store.addRecords(viewObjects)
        // 4. 返回记录 ID 列表
        const recordIds = viewObjects.map((r) => r.id)
        return [{ recordIds, pagination: result.pagination }, null]
    }
}

/**
 * Pom Pomodoro 记录用例工厂函数
 * @param store Pomodoro 记录存储
 * @returns Pomodoro 记录用例
 */
// export const newPomodoroRecordUseCase = (store: PomodoroRecordStore) => {
//     const requester = getRequesterImpl()
//     const pomodoroRepo = newPomodoroRepository(requester)
//     const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
//     const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
//     return new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
// }