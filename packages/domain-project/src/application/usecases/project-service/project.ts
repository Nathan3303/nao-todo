import type { GoAsync } from '@nao-todo/shared/types'
import type {
    ProjectPreferenceRepository,
    ProjectRepository,
    ProjectService
} from '../../../domain'
import type { ProjectStore } from '../../stores'
import type {
    CreateProjectViewObject,
    ProjectPreferenceViewObject,
    ProjectViewObject,
    UpdateProjectViewObject
} from '../../viewobjects'
import {
    createProjectViewObjectToValueObject,
    projectEntitiesToViewObjects,
    projectEntityToViewObject,
    projectPreferenceEntityToViewObject,
    projectPreferenceViewObjectToEntity,
    updateProjectViewObjectToValueObject
} from './converters'

/**
 * 项目用例
 * @description 负责处理项目相关的业务逻辑，包括加载项目、创建项目、加载项目偏好等
 */
export class ProjectUseCase {
    /**
     * 项目用例构造函数
     * @param projectService 项目服务
     * @param projectRepo 项目仓库
     * @param projectPreferenceRepo 项目偏好仓库
     * @param store 项目状态管理
     */
    constructor(
        private projectService: ProjectService,
        private projectRepo: ProjectRepository,
        private projectPreferenceRepo: ProjectPreferenceRepository,
        private store: ProjectStore
    ) {}

    /**
     * 加载项目
     * @returns 项目视图对象数组
     */
    async loadProjects(): GoAsync<void> {
        // 调用领域层方法
        const [projectEntities, err] = await this.projectRepo.list()
        if (err !== null) {
            return err
        }
        // 按 sortId 排序
        const sorted = projectEntities.sort((a, b) => a.sortId - b.sortId)
        // 转换为视图对象
        const projects = projectEntitiesToViewObjects(sorted)
        // 存储到状态管理
        this.store.setProjects(projects)
        return null
    }

    /**
     * 创建项目
     * @param createProjectViewObject 创建项目视图对象
     * @returns 项目视图对象
     */
    async createProject(
        createProjectViewObject: CreateProjectViewObject
    ): GoAsync<ProjectViewObject> {
        // 数据转换：视图对象转换为值对象
        const createProjectValueObject =
            createProjectViewObjectToValueObject(createProjectViewObject)
        // 调用领域层方法
        const [projectEntity, err] =
            await this.projectService.createProject(createProjectValueObject)
        if (err !== null) {
            return [null, err]
        }
        // 转换为视图对象
        const project = projectEntityToViewObject(projectEntity)
        // 存储到状态管理
        this.store.addProject(project)
        return [project, null]
    }

    /**
     * 加载项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好视图对象
     */
    async loadProjectPreference(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 调用领域层方法
        const [preferenceEntity, err] = await this.projectPreferenceRepo.getByProjectId(projectId)
        if (err !== null) {
            return err
        }
        // 转换为视图对象
        const preference = projectPreferenceEntityToViewObject(preferenceEntity)
        // 存储到状态管理
        this.store.setProjectPreference(preference)
        // 返回
        return null
    }

    /**
     * 保存项目偏好
     * @param projectId 项目ID
     * @param projectPreferenceViewObject 新项目偏好视图对象
     * @returns 错误信息
     */
    async saveProjectPreference(
        projectId: ProjectViewObject['id'],
        projectPreferenceViewObject: ProjectPreferenceViewObject
    ): GoAsync<void> {
        // 判断项目偏好是否存在
        if (!projectPreferenceViewObject) return '项目偏好无效'
        // 转换为项目偏好实体
        const preferenceEntity = projectPreferenceViewObjectToEntity(projectPreferenceViewObject)
        preferenceEntity.projectId = projectId
        // 存储项目偏好实体
        return await this.projectPreferenceRepo.save(preferenceEntity)
    }

    /**
     * 删除项目
     * @param projectId 项目ID
     * @returns 无
     */
    async delete(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 删除任务清单
        const err = await this.projectRepo.delete(projectId)
        if (err !== null) return err
        // 更新状态管理
        this.store.softDeleteProject(projectId)
        return null
    }

    /**
     * 恢复项目
     * @param projectId 项目ID
     * @returns 无
     */
    async restore(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 恢复任务清单
        const err = await this.projectRepo.restore(projectId)
        if (err !== null) return err
        // 更新状态管理
        this.store.restoreProject(projectId)
        return null
    }

    /**
     * 归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async archive(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 直接调用，不做确认
        return await this.projectRepo.delete(projectId)
    }

    /**
     * 取消归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async unarchive(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 直接调用，不做确认
        return await this.projectRepo.delete(projectId)
    }

    /**
     * 更新任务清单
     * @param id 项目ID
     * @param updateProjectViewObject 更新项目视图对象
     * @returns 无
     */
    async update(
        id: ProjectViewObject['id'],
        updateProjectViewObject: UpdateProjectViewObject
    ): GoAsync<void> {
        // 数据转换
        const updateProjectValueObject = updateProjectViewObjectToValueObject(
            id,
            updateProjectViewObject
        )
        // 更新
        const updateError = await this.projectRepo.update(updateProjectValueObject)
        if (updateError !== null) {
            return updateError
        }
        // 同步本地状态
        this.store.updateProject(id, updateProjectViewObject)
        return null
    }

    /**
     * 重新排序项目 - 使用浮动间隔排序法
     * @param originalId 被拖拽项目ID
     * @param boundId 目标项目ID
     * @param isBefore 是否插入到目标之前
     * @returns 排序结果
     */
    async resort(
        originalId: ProjectViewObject['id'],
        boundId: ProjectViewObject['id'],
        isBefore: boolean
    ): GoAsync<void> {
        const originalProject = this.store.getProject(originalId)
        const boundProject = this.store.getProject(boundId)
        if (!originalProject || !boundProject) return '项目不存在'

        if (originalId === boundId) return null

        const allProjects = this.store.getAllProjects()
        const activeProjects = allProjects.filter((p) => !p.isDeleted && !p.isArchived)

        if (activeProjects.length <= 1) return null

        const sortedProjects = [...activeProjects].sort((a, b) => a.sortId - b.sortId)

        const originalIndex = sortedProjects.findIndex((p) => p.id === originalId)
        const boundIndex = sortedProjects.findIndex((p) => p.id === boundId)

        if (originalIndex === -1 || boundIndex === -1) return '项目不存在'

        const tempProjects = [...sortedProjects]
        tempProjects.splice(originalIndex, 1)

        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }

        let prevProject: ProjectViewObject | null = null
        let nextProject: ProjectViewObject | null = null

        if (newIndex === 0) {
            nextProject = tempProjects[0] || null
        } else if (newIndex === tempProjects.length) {
            prevProject = tempProjects[tempProjects.length - 1] || null
        } else {
            prevProject = tempProjects[newIndex - 1] || null
            nextProject = tempProjects[newIndex] || null
        }

        // 如果原 sortId 在新位置依旧成立，则无需发送网络请求
        let isSortIdStillValid = false
        if (!prevProject) {
            isSortIdStillValid = originalProject.sortId < nextProject!.sortId
        } else if (!nextProject) {
            isSortIdStillValid = originalProject.sortId > prevProject.sortId
        } else {
            isSortIdStillValid =
                originalProject.sortId > prevProject.sortId &&
                originalProject.sortId < nextProject.sortId
        }

        if (isSortIdStillValid) return null

        let newSortId: number
        const INTERVAL = 1000

        if (!prevProject) {
            newSortId = nextProject!.sortId - INTERVAL
        } else if (!nextProject) {
            newSortId = prevProject.sortId + INTERVAL
        } else {
            newSortId = Math.round((prevProject.sortId + nextProject.sortId) / 2)
        }

        const needsRebuild =
            (prevProject && nextProject && Math.abs(nextProject.sortId - prevProject.sortId) < 2) ||
            newSortId <= 0

        if (needsRebuild) {
            return this.resortWithRebuild(originalId, boundId, isBefore)
        } else {
            return this.resortSingle(originalId, newSortId)
        }
    }

    /**
     * 单项目排序更新 - 99% 的情况使用此方法
     * @param originalId 被拖拽项目ID
     * @param newSortId 新的 sortId
     * @returns 排序结果
     */
    async resortSingle(originalId: string, newSortId: number): GoAsync<void> {
        const updateVO = { id: originalId, sortId: newSortId } as UpdateProjectViewObject
        this.store.updateProject(originalId, updateVO)
        const err = await this.update(originalId, updateVO)
        return err !== null ? err : null
    }

    /**
     * 重建项目排序 - 间隔太小时触发
     * @param originalId 被拖拽项目ID
     * @param boundId 目标项目ID
     * @param isBefore 是否插入到目标之前
     * @returns 排序结果
     */
    async resortWithRebuild(originalId: string, boundId: string, isBefore: boolean): GoAsync<void> {
        const allProjects = this.store.getAllProjects()
        const activeProjects = allProjects.filter((p) => !p.isDeleted && !p.isArchived)

        if (!activeProjects.length) return null

        const sortedProjects = [...activeProjects].sort((a, b) => a.sortId - b.sortId)

        const originalIndex = sortedProjects.findIndex((p) => p.id === originalId)
        const boundIndex = sortedProjects.findIndex((p) => p.id === boundId)

        if (originalIndex === -1 || boundIndex === -1) return '项目不存在'

        const [movedProject] = sortedProjects.splice(originalIndex, 1)

        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }

        sortedProjects.splice(newIndex, 0, movedProject || ({} as ProjectViewObject))

        const INTERVAL = 1000
        const projectsToUpdate = sortedProjects.map((project, index) => ({
            ...project,
            sortId: (index + 1) * INTERVAL
        }))

        this.store.updateProjects(projectsToUpdate)

        const updateProjectViewObjects = projectsToUpdate.map((project) => {
            return { id: project.id, updatedAt: project.updatedAt, sortId: project.sortId }
        })

        const [batchResult, err] = await this.projectService.batchUpdateProject(
            updateProjectViewObjects.map((p) => updateProjectViewObjectToValueObject(p.id, p))
        )
        if (err !== null) return err

        const updatedProjects = batchResult.map(projectEntityToViewObject)
        this.store.updateProjects(updatedProjects)

        return null
    }
}