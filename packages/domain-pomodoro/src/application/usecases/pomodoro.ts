import type { GoAsync } from '@nao-todo/shared'
import { PomodoroRepository } from '@nao-todo/domain-pomodoro'
import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import type {
    CreatePomodoroViewObject,
    PomodoroType,
    PomodoroViewObject,
    UpdatePomodoroViewObject
} from '../viewobjects/pomodoro'
import type { PomodoroStore } from '../stores'
import { ListPomodoroValueObject } from '@nao-todo/domain-pomodoro'
import {
    createPomodoroViewObjectToValueObject,
    pomodoroEntitiesToViewObjects,
    pomodoroEntityToViewObject,
    updatePomodoroViewObjectToValueObject
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
        private pomodoroRepo: PomodoroRepository,
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

    /**
     * 更新常用番茄专注
     * @param id 常用番茄专注 ID
     * @param updateViewObject 更新常用番茄专注视图对象
     * @returns 错误信息
     */
    async update(id: string, updateViewObject: UpdatePomodoroViewObject): GoAsync<void> {
        // 1. 视图对象 → 值对象
        const valueObject = updatePomodoroViewObjectToValueObject(id, updateViewObject)
        // 2. 调用领域服务
        const err = await this.pomodoroDomain.update(valueObject)
        if (err !== null) return err
        // 3. 就地更新存储
        this.store.patchPomodoro(id, { ...updateViewObject })
        // 4. 返回
        return null
    }

    /**
     * 加载常用番茄专注列表
     * @param options 查询选项
     * @returns 错误信息
     */
    async loadPomodoros(options?: {
        type?: PomodoroType
        name?: string
        isArchived?: boolean
    }): GoAsync<void> {
        // 1. 构建查询值对象
        const listValueObject = new ListPomodoroValueObject()
        if (options?.type !== void 0) listValueObject.type = options.type
        if (options?.name !== void 0) listValueObject.name = options.name
        if (options?.isArchived !== void 0) {
            listValueObject.isArchived = String(options.isArchived)
        }
        // 2. 调用领域服务
        const [result, err] = await this.pomodoroDomain.list(listValueObject)
        if (err !== null) return err
        // 3. 实体 → 视图对象
        const viewObjects = pomodoroEntitiesToViewObjects(result.pomodoroEntities)
        // 4. 存储到状态管理
        this.store.setPomodoros(viewObjects)
        // 5. 返回
        return null
    }
}

/**
 * 创建 Pomodoro 用例
 * @param store Pomodoro 存储
 * @returns Pomodoro 用例
 */
// export const newPomodoroUseCase = (store: PomodoroStore) => {
//     const requester = getRequesterImpl()
//     const pomodoroRepo = newPomodoroRepository(requester)
//     const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
//     const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
//     return new PomodoroUseCase(domain, pomodoroRepo, store)
// }
