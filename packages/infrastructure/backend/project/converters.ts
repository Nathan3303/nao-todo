import {
    CreateProjectValueObject,
    ProjectEntity,
    ProjectPreferenceEntity,
    SaveProjectPreferenceValueObject,
    UpdateProjectValueObject
} from '@nao-todo/domain/project'
import type {
    CreateProjectRes,
    ProjectPreferenceRes,
    ProjectRes,
    ListProjectRes,
    UpdateProjectPreferenceReq,
    UpdateProjectReq,
    CreateProjectReq
} from '../models'
import { defaultColumns } from '@nao-todo/shared'
import dayjs from 'dayjs'

// --- Project ---

/**
 * 项目响应转换为项目实体
 * @param res 项目响应
 * @returns 项目实体
 */
export const projectRes2Entity = (res: ProjectRes): ProjectEntity => {
    return new ProjectEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.name,
        'more2', // TODO: 后端没有返回图标
        res.description,
        res.archivedAt,
        res.deactivedAt,
        res.sortId
    )
}

/**
 * 创建项目值对象转换为创建项目请求
 * @param createVO 创建项目值对象
 * @returns 创建项目请求
 */
export const createProjectValueObject2Req = (
    createVO: CreateProjectValueObject
): CreateProjectReq => {
    return {
        name: createVO.name,
        description: createVO.description
    }
}

/**
 * 创建项目响应转换为项目实体
 * @param res 创建项目响应
 * @returns 项目实体
 */
export const createProjectRes2Entity = (res: CreateProjectRes): ProjectEntity => {
    return projectRes2Entity(res)
}

/**
 * 更新项目值对象转换为更新项目请求
 * @param updateProjectValueObject 更新项目值对象
 * @returns 更新项目请求
 */
export const updateProjectValueObject2Req = (
    updateVO: UpdateProjectValueObject
): UpdateProjectReq => {
    const rto: UpdateProjectReq = {}
    rto.id = updateVO.id
    if (updateVO.name !== void 0) rto.name = updateVO.name
    if (updateVO.description !== void 0) rto.description = updateVO.description
    if (updateVO.sortId !== void 0) rto.sortId = updateVO.sortId
    return rto
}

/**
 * 项目列表响应转换为项目实体列表
 * @param res 项目列表响应
 * @returns 项目实体列表
 */
export const listProjectRes2Entities = (res: ListProjectRes): ProjectEntity[] => {
    return res.map((project) => projectRes2Entity(project))
}

// --- Project Preference ---

/**
 * 项目偏好响应转换为项目偏好实体
 * @param res 项目偏好响应
 * @returns 项目偏好实体
 */
export const projectPreferenceRes2Entity = (res: ProjectPreferenceRes): ProjectPreferenceEntity => {
    return new ProjectPreferenceEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.projectId,
        res.viewType,
        res.getTasksOptions,
        res.columns
    )
}

/**
 * 创建默认项目偏好实体
 * @returns 默认项目偏好实体
 */
export const defaultProjectPreferenceRes2Entity = (): ProjectPreferenceEntity => {
    const today = dayjs().toISOString()
    return new ProjectPreferenceEntity(
        '',
        today,
        today,
        null,
        '',
        'table',
        '{}',
        JSON.stringify(defaultColumns)
    )
}

/**
 * 项目偏好实体转换为更新项目偏好请求
 * @param preferenceEntity 项目偏好实体
 * @returns 更新项目偏好请求
 */
export const saveProjectPreferenceValueObject2Req = (
    saveVO: SaveProjectPreferenceValueObject
): UpdateProjectPreferenceReq => {
    const req = {} as UpdateProjectPreferenceReq
    if (saveVO.viewType !== void 0) req.viewType = saveVO.viewType
    if (saveVO.getTasksOptions !== void 0) req.getTasksOptions = saveVO.getTasksOptions
    if (saveVO.columns !== void 0) req.columns = saveVO.columns
    return req
}

