import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject,
    PomodoroEntity,
    PomodoroRecordEntity
} from '@nao-todo/domain/pomodoro'
import type {
    CreatePomodoroRecordViewObject,
    CreatePomodoroViewObject,
    PomodoroRecordViewObject,
    PomodoroViewObject
} from './viewobjects'
import dayjs from 'dayjs'

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
export const pomodoroEntitiesToViewObjects = (
    entities: PomodoroEntity[]
): PomodoroViewObject[] => {
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
 * Pomodoro 记录实体 → Pomodoro 记录视图对象
 */
export const pomodoroRecordEntityToViewObject = (
    entity: PomodoroRecordEntity
): PomodoroRecordViewObject => {
    return {
        id: entity.id,
        sessionId: entity.sessionId,
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
        viewObject.taskId,
        viewObject.taskName,
        viewObject.description,
        viewObject.startAt,
        viewObject.endAt,
        viewObject.duration,
        viewObject.note
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

