import { PomodoroRecordEntity } from '@nao-todo/domain/pomodoro'
import type { CreatePomodoroReq, CreatePomodoroRes, GetPomodoroRes, ListPomodoroRes } from '../types'
import { CreatePomodoroRecordValueObject } from '@nao-todo/domain/pomodoro'

/**
 * GetPomodoroRes → PomodoroRecordEntity
 */
export const getPomodoroRes2Entity = (res: GetPomodoroRes): PomodoroRecordEntity => {
    return new PomodoroRecordEntity(
        res.id,
        res.sessionId,
        res.type,
        res.taskId,
        res.taskName,
        res.description,
        res.startAt,
        res.endAt,
        res.duration,
        res.note,
        res.createdAt,
        res.updatedAt,
        res.deletedAt
    )
}

/**
 * CreatePomodoroRes → PomodoroRecordEntity
 * CreatePomodoroRes 不含 deletedAt，默认 null
 */
export const createPomodoroRes2Entity = (res: CreatePomodoroRes): PomodoroRecordEntity => {
    return new PomodoroRecordEntity(
        res.id,
        res.sessionId,
        res.type,
        res.taskId,
        res.taskName,
        res.description,
        res.startAt,
        res.endAt,
        res.duration,
        res.note,
        res.createdAt,
        res.updatedAt,
        null
    )
}

/**
 * ListPomodoroRes → PomodoroRecordEntity[]
 */
export const listPomodoroRes2Entities = (res: ListPomodoroRes): PomodoroRecordEntity[] => {
    return res.map(getPomodoroRes2Entity)
}

/**
 * CreatePomodoroRecordValueObject → CreatePomodoroReq
 */
export const createPomodoroValueObjectToReq = (
    valueObject: CreatePomodoroRecordValueObject
): CreatePomodoroReq => {
    return {
        sessionId: valueObject.sessionId,
        type: valueObject.type,
        taskId: valueObject.taskId,
        taskName: valueObject.taskName,
        description: valueObject.description || undefined,
        startAt: valueObject.startAt,
        endAt: valueObject.endAt,
        duration: valueObject.duration,
        note: valueObject.note || undefined
    }
}
