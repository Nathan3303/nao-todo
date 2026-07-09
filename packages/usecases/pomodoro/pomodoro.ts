import { PomodoroDomain } from '@nao-todo/domain/pomodoro'
import { newPomodoroRecordRepository, newPomodoroRepository, PomodoroRepoImpl } from '@nao-todo/infrastructure/backend/pomodoro'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { GoAsync } from '@nao-todo/types'
import { PomodoroStore } from './store'
import { CreatePomodoroViewObject, PomodoroViewObject } from './viewobjects'
import {
    createPomodoroViewObjectToValueObject,
    pomodoroEntityToViewObject
} from './converters'

/**
 * Pomodoro 用例
 */
export class PomodoroUseCase {
    /**
     * Pomodoro 用例构造函数
     * @param pomodoroDomain Pomodoro 业务逻辑层
     * @param pomodoroRepo Pomodoro 数据访问层
     * @param store 存储
     */
    constructor(
        private pomodoroDomain: PomodoroDomain,
        private pomodoroRepo: PomodoroRepoImpl,
        private store: PomodoroStore
    ) {}

    /**
     * 创建常用番茄专注
     * @param createViewObject 创建常用番茄专注视图对象
     * @returns 创建的常用番茄专注视图对象
     */
    async create(createViewObject: CreatePomodoroViewObject): GoAsync<PomodoroViewObject> {
        // 1. 视图对象 → 值对象
        const valueObject = createPomodoroViewObjectToValueObject(createViewObject)
        // 2. 调用数据访问层
        const [entity, err] = await this.pomodoroRepo.create(valueObject)
        if (err !== null) return [null, err]
        // 3. 实体 → 视图对象
        const viewObject = pomodoroEntityToViewObject(entity)
        // 4. 更新存储
        this.store.addPomodoro(viewObject)
        // 5. 返回
        return [viewObject, null]
    }
}

export const newPomodoroUseCase = (store: PomodoroStore) => {
    const requester = getRequesterImpl()
    const pomodoroRepo = newPomodoroRepository(requester)
    const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroUseCase(domain, pomodoroRepo, store)
}
