import {
    useMapperStoreBase,
    useStoreBase,
    type GetTasksOptions,
    type TaskColumnOptions
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import type { ProjectPreferenceViewObject, ProjectViewObject } from '../types'

export const useProjectsStoreBase = () => {
    const {
        list: projects,
        setList: setProjects,
        addItem: addProject,
        getItem: getProject,
        updateItem: setProject,
        patchItem: updateProject,
        updateList: updateProjects,
        removeItem: deleteProject
    } = useMapperStoreBase<ProjectViewObject>()

    // @action 获取所有项目
    const getAllProjects = () => {
        const allProjects: ProjectViewObject[] = []
        projects.value.forEach((project) => allProjects.push(project))
        return allProjects
    }

    // @action 软删除项目
    const softDeleteProject = (id: string) => {
        updateProject(id, { isDeleted: true, deactivedAt: dayjs().toISOString() })
    }

    // @action 恢复项目
    const restoreProject = (id: string) => {
        updateProject(id, { isDeleted: false, deactivedAt: null })
    }

    // @action 归档项目
    const archiveProject = (id: string) => {
        updateProject(id, { isArchived: true, archivedAt: dayjs().toISOString() })
    }

    // @action 取消归档项目
    const unarchiveProject = (id: string) => {
        updateProject(id, { isArchived: false, archivedAt: null })
    }

    // @returns
    return {
        projects,
        getAllProjects,
        setProjects,
        addProject,
        getProject,
        setProject,
        updateProject,
        updateProjects,
        softDeleteProject,
        restoreProject,
        archiveProject,
        unarchiveProject,
        deleteProject
    }
}

export const useProjectPreferenceStoreBase = () => {
    const {
        state: projectPreference,
        setState: setProjectPreference,
        patchState: updateProjectPeference
    } = useStoreBase<ProjectPreferenceViewObject>()

    // @action 获取项目偏好
    const getProjectPreference = (): ProjectPreferenceViewObject | undefined => {
        return projectPreference.value
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        updateProjectPeference((state) => {
            state.columns[key] = value
            return state
        })
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        updateProjectPeference((state) => {
            state.getTasksOptions[key] = value
            return state
        })
    }

    // @action 获取偏好 - 任务获取选项(key)
    const getPreferenceGetTasksOption = <T extends keyof GetTasksOptions>(
        key: T
    ): GetTasksOptions[T] => {
        if (!projectPreference.value) return
        return projectPreference.value.getTasksOptions[key]
    }

    // @action 获取偏好 - 任务获取选项(所有)
    const getPreferenceGetTasksOptions = (): GetTasksOptions => {
        if (!projectPreference.value) return {}
        return projectPreference.value.getTasksOptions
    }

    // @return
    return {
        projectPreference,
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
}

export type ProjectsStoreBase = ReturnType<typeof useProjectsStoreBase>
export type ProjectPreferenceStoreBase = ReturnType<typeof useProjectPreferenceStoreBase>
