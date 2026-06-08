import { PomodoroRecordEntity, CreatePomodoroRecordValueObject } from '@nao-todo/domain/pomodoro'
import type { CreatePomodoroRecordViewObject, PomodoroRecordViewObject } from '@nao-todo/types'

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
export const createPomodoroViewObjectToValueObject = (
    viewObject: CreatePomodoroRecordViewObject
): CreatePomodoroRecordValueObject => {
    return new CreatePomodoroRecordValueObject(
        viewObject.sessionId,
        viewObject.type,
        viewObject.taskId,
        viewObject.taskName,
        viewObject.description || '',
        viewObject.startAt,
        viewObject.endAt,
        viewObject.duration,
        viewObject.note || ''
    )
}
