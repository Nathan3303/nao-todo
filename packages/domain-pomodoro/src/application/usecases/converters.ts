import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject,
    PomodoroEntity,
    PomodoroRecordEntity,
    UpdatePomodoroValueObject
} from '@nao-todo/domain/pomodoro'
import dayjs from 'dayjs'
import type {
    CreatePomodoroRecordViewObject,
    CreatePomodoroViewObject,
    PomodoroRecordViewObject,
    PomodoroViewObject,
    UpdatePomodoroViewObject
} from '../viewobjects'

/**
 * 常用番茄专注实体 → 常用番茄专注视图对象
 */
export const pomodoroEntityToViewObject = (entity: PomodoroEntity): PomodoroViewObject => {
    return {
        id: entity.id,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
        type: entity.type as PomodoroViewObject['type'],
        name: entity.name,
        description: entity.description,
        duration: entity.duration,
        archivedAt: entity.archivedAt,
        totalDuration: entity.totalDuration,
        isArchived: dayjs(entity.archivedAt).isValid()
    }
}

/**
 * 常用番茄专注实体列表 → 常用番茄专注视图对象列表
 */
export const pomodoroEntitiesToViewObjects = (entities: PomodoroEntity[]): PomodoroViewObject[] => {
    return entities.map(pomodoroEntityToViewObject)
}

/**
 * 创建常用番茄专注视图对象 → 创建常用番茄专注值对象
 */
export const createPomodoroViewObjectToValueObject = (
    viewObject: CreatePomodoroViewObject
): CreatePomodoroValueObject => {
    return new CreatePomodoroValueObject(
        viewObject.type,
        viewObject.name,
        viewObject.description ?? '',
        viewObject.duration
    )
}

/**
 * 更新常用番茄专注视图对象 → 更新常用番茄专注值对象
 */
export const updatePomodoroViewObjectToValueObject = (
    id: string,
    viewObject: UpdatePomodoroViewObject
): UpdatePomodoroValueObject => {
    const valueObject = new UpdatePomodoroValueObject(id)
    if (viewObject.type !== void 0) valueObject.type = viewObject.type
    if (viewObject.name !== void 0) valueObject.name = viewObject.name
    if (viewObject.description !== void 0) {
        valueObject.description = viewObject.description ?? ''
    }
    if (viewObject.duration !== void 0) valueObject.duration = viewObject.duration
    return valueObject
}

/**
 * Pomodoro 记录实体 → Pomodoro 记录视图对象
 */
export const pomodoroRecordEntityToViewObject = (
    entity: PomodoroRecordEntity
): PomodoroRecordViewObject => {
    return {
        id: entity.id,
        sessionId: entity.sessionId, // 会话ID
        pomodoroId: entity.pomodoroId, // 常用番茄专注ID
        type: entity.type as PomodoroRecordViewObject['type'],
        taskId: entity.taskId,
        taskName: entity.taskName,
        description: entity.description,
        startAt: entity.startAt,
        endAt: entity.endAt,
        duration: entity.duration,
        note: entity.note,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt
    }
}

/**
 * 创建 Pomodoro 记录视图对象 → 创建 Pomodoro 记录值对象
 */
export const createPomodoroRecordViewObjectToValueObject = (
    viewObject: CreatePomodoroRecordViewObject
): CreatePomodoroRecordValueObject => {
    return new CreatePomodoroRecordValueObject(
        viewObject.sessionId,
        viewObject.type,
        viewObject.startAt,
        viewObject.endAt,
        viewObject.duration,
        viewObject.pomodoroId || '',
        viewObject.taskId || '',
        viewObject.taskId ? viewObject.taskName : '',
        viewObject.description || '',
        viewObject.note || ''
    )
}

/**
 * Pomodoro 记录实体列表 → Pomodoro 记录视图对象列表
 */
export const pomodoroRecordEntitiesToViewObjects = (
    entities: PomodoroRecordEntity[]
): PomodoroRecordViewObject[] => {
    return entities.map(pomodoroRecordEntityToViewObject)
}
