import { PomodoroRecordDomain } from '@nao-todo/domain/pomodoro'
import type { GoAsync, PomodoroRecordViewObject, CreatePomodoroRecordViewObject } from '@nao-todo/types'
import {
    createPomodoroViewObjectToValueObject,
    pomodoroRecordEntityToViewObject
} from '../converters/pomodoro'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { usePomodoroRecordRepository } from '@nao-todo/infrastructure/backend/pomodoro/repoImpl'

/**
 * Pomodoro 记录存储接口
 * @description PomodoroUseCase 依赖的存储抽象
 */
export interface PomodoroRecordStore {
    addRecord(record: PomodoroRecordViewObject): void
}

/**
 * Pomodoro 记录用例
 */
export class PomodoroRecordUseCase {
    constructor(
        private pomodoroRecordDomain: PomodoroRecordDomain,
        private store: PomodoroRecordStore
    ) {}

    /**
     * 创建 PomodoroRecordUseCase 实例
     * @param store 存储实现
     * @returns PomodoroRecordUseCase 实例
     */
    static create(store: PomodoroRecordStore): PomodoroRecordUseCase {
        return new PomodoroRecordUseCase(
            new PomodoroRecordDomain(usePomodoroRecordRepository(getRequesterImpl())),
            store
        )
    }

    /**
     * 创建 Pomodoro 记录
     * @param createViewObject 创建记录视图对象
     * @returns 创建的 Pomodoro 记录视图对象
     */
    async createRecord(
        createViewObject: CreatePomodoroRecordViewObject
    ): GoAsync<PomodoroRecordViewObject> {
        // 1. 视图对象 → 值对象
        const valueObject = createPomodoroViewObjectToValueObject(createViewObject)

        // 2. 调用领域服务
        const [entity, err] = await this.pomodoroRecordDomain.create(valueObject)
        if (err !== null) return [null, err]

        // 3. 实体 → 视图对象
        const viewObject = pomodoroRecordEntityToViewObject(entity)

        // 4. 更新存储
        this.store.addRecord(viewObject)

        // 5. 返回
        return [viewObject, null]
    }
}
