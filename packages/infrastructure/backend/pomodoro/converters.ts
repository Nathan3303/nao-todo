import {
    CreatePomodoroValueObject,
    PomodoroEntity,
    PomodoroRecordEntity,
    UpdatePomodoroValueObject
} from '@nao-todo/domain/pomodoro'
import type {
    PomodoroRecordRes,
    CreatePomodoroRecordRes,
    ListPomodoroRecordRes,
    CreatePomodoroRecordReq,
    PomodoroRes,
    CreatePomodoroReq,
    CreatePomodoroRes,
    UpdatePomodoroReq,
    ListPomodoroRes
} from '../models'
import { CreatePomodoroRecordValueObject } from '@nao-todo/domain/pomodoro'

// --- Pomodoro ---

/**
 * 将番茄专注响应转换为实体
 * @param res 番茄专注响应
 * @returns 番茄专注实体
 */
export const pomodoroRes2Entity = (res: PomodoroRes): PomodoroEntity => {
    return new PomodoroEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.type,
        res.name,
        res.description,
        res.duration,
        res.archivedAt,
        res.totalDuration
    )
}

/**
 * 将创建番茄专注值对象转换为请求
 * @param createVO 创建番茄专注值对象
 * @returns 创建番茄专注请求
 */
export const createPomodoroValueObject2Req = (
    createVO: CreatePomodoroValueObject
): CreatePomodoroReq => {
    const req = {} as CreatePomodoroReq
    req.type = createVO.type
    req.name = createVO.name
    req.description = createVO.description
    req.duration = createVO.duration
    return req
}

/**
 * 将创建番茄专注响应转换为实体
 * @param res 创建番茄专注响应
 * @returns 创建番茄专注实体
 */
export const createPomodoroRes2Entity = (res: CreatePomodoroRes): PomodoroEntity => {
    return pomodoroRes2Entity(res)
}

/**
 * 更新番茄专注值对象转换为请求体
 * @param updateVO 更新番茄专注值对象
 * @returns 更新番茄专注请求体
 */
export const UpdatePomodoroValueObject2Req = (
    updateVO: UpdatePomodoroValueObject
): UpdatePomodoroReq => {
    const req = {} as UpdatePomodoroReq
    if (updateVO.type !== void 0) req.type = updateVO.type
    if (updateVO.name !== void 0) req.name = updateVO.name
    if (updateVO.description !== void 0) req.description = updateVO.description
    if (updateVO.duration !== void 0) req.duration = updateVO.duration
    return req
}

/**
 * 将番茄专注列表响应转换为实体列表
 * @param res 番茄专注列表响应
 * @returns 番茄专注实体列表
 */
export const ListPomodoroRes2Entities = (res: ListPomodoroRes): PomodoroEntity[] => {
    return res.map(pomodoroRes2Entity)
}

// --- Pomodoro Record ---

/**
 * 将番茄专注记录响应转换为实体
 * @param res 番茄专注记录响应
 * @returns 番茄专注记录实体
 */
export const pomodoroRecordRes2Entity = (res: PomodoroRecordRes): PomodoroRecordEntity => {
    return new PomodoroRecordEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.sessionId,
        res.pomodoroId,
        res.type,
        res.taskId,
        res.taskName,
        res.description,
        res.startAt,
        res.endAt,
        res.duration,
        res.note
    )
}

/**
 * 将创建番茄专注记录值对象转换为请求体
 * @param createVO 创建番茄专注记录值对象
 * @returns 创建番茄专注记录请求体
 */
export const createPomodoroRecordValueObjectToReq = (
    createVO: CreatePomodoroRecordValueObject
): CreatePomodoroRecordReq => {
    return {
        sessionId: createVO.sessionId,
        pomodoroId: createVO.pomodoroId || null,
        type: createVO.type,
        taskId: createVO.taskId,
        taskName: createVO.taskName,
        description: createVO.description || null,
        startAt: createVO.startAt,
        endAt: createVO.endAt,
        duration: createVO.duration,
        note: createVO.note || null
    }
}

/**
 * 将创建番茄专注记录响应转换为实体
 * @param res 创建番茄专注记录响应
 * @returns 创建番茄专注记录实体
 */
export const createPomodoroRecordRes2Entity = (
    res: CreatePomodoroRecordRes
): PomodoroRecordEntity => {
    return pomodoroRecordRes2Entity(res)
}

/**
 * 将番茄专注记录列表响应转换为实体列表
 * @param res 番茄专注记录列表响应
 * @returns 番茄专注记录实体列表
 */
export const listPomodoroRecordRes2Entities = (
    res: ListPomodoroRecordRes
): PomodoroRecordEntity[] => {
    return res.map(pomodoroRecordRes2Entity)
}

