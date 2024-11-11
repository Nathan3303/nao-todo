import { useProjectStoreV2 } from '@nao-todo/stores/use-project-store'
import {
    FetchProjectsOptions,
    Project,
    ProjectPreference
} from '@nao-todo/stores/use-project-store/v2/types'
import { NueConfirm } from 'nue-ui'

const projectStore = useProjectStoreV2()

// 获取近期修改的 10 个清单（侧栏）
export const getSmartListData = async () => {
    const response = await projectStore.fetchProjects({
        isDeleted: false,
        page: 1,
        limit: 10,
        sort: { field: 'updatedAt', order: 'desc' },
        toGetted: true
    })
    if (response.code === 20000) {
        return response.data as Project[]
    }
    console.warn('[ProjectHandlers] getSmartListData:', response.message)
    return [] as Project[]
}

// 获取用户所有清单（清单管理器，带分页）
export const getProjects = async (options: FetchProjectsOptions) => {
    const response = await projectStore.fetchProjects({
        sort: { field: 'createdAt', order: 'desc' },
        ...options
    })
    if (response.code === 20000) return true
    console.warn('[ProjectHandlers] getProjects:', response.message)
    return false
}

// 更新指定清单的偏好设置
export const updateProjectPreference = async (
    projectId: Project['id'],
    newPreference: Partial<ProjectPreference>
) => {
    const targetProjectIndex = projectStore.projects.findIndex(
        (project) => project.id === projectId
    )
    const targetProject = projectStore.projects[targetProjectIndex]
    const oldPreference = targetProject.preference
    const updateOptions = { preference: { ...oldPreference, ...newPreference } }
    const response = await projectStore.updateProject(projectId, updateOptions)
    if (response.code === 20000) return true
    console.warn('[ProjectHandlers] updateProjectPreference:', response.message)
    return false
}

// 删除指定清单（带确认）
export const removeProjectWithConfirmation = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '删除清单确认',
            content: '确认删除该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const updateOptions = { isDeleted: true, deletedAt: Date.now() }
        const response = await projectStore.updateProject(projectId, updateOptions)
        if (response.code === 20000) return true
        console.warn('[ProjectHandlers] removeProjectWithConfirmation:', response.message)
        return false
    } catch (error) {
        console.warn('[ProjectHandlers] removeProjectWithConfirmation:', error)
        return false
    }
}

// 恢复指定清单（带确认）
export const restoreProjectWithConfirmation = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '恢复清单确认',
            content: '确认恢复该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const updateOptions = { isDeleted: false, deletedAt: null }
        const response = await projectStore.updateProject(projectId, updateOptions)
        if (response.code === 20000) return true
        console.warn('[ProjectHandlers] restoreProjectWithConfirmation:', response.message)
        return false
    } catch (error) {
        console.warn('[ProjectHandlers] restoreProjectWithConfirmation:', error)
        return false
    }
}

// 归档指定清单（带确认）
export const archiveProjectWithConfirmation = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '归档清单确认',
            content: '确认归档该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const updateOptions = { isArchived: true, archivedAt: Date.now() }
        const response = await projectStore.updateProject(projectId, updateOptions)
        if (response.code === 20000) return true
        console.warn('[ProjectHandlers] archiveProjectWithConfirmation:', response.message)
        return false
    } catch (error) {
        console.warn('[ProjectHandlers] archiveProjectWithConfirmation:', error)
        return false
    }
}

// 取消归档指定清单（带确认）
export const unarchiveProjectWithConfirmation = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '取消归档清单确认',
            content: '确认取消归档该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const updateOptions = { isArchived: false, archivedAt: null }
        const response = await projectStore.updateProject(projectId, updateOptions)
        if (response.code === 20000) return true
        console.warn('[ProjectHandlers] unarchiveProjectWithConfirmation:', response.message)
        return false
    } catch (error) {
        console.warn('[ProjectHandlers] unarchiveProjectWithConfirmation:', error)
        return false
    }
}

// 永久删除指定清单（带确认）
export const removeProjectPermanently = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '永久删除清单确认',
            content: '确认永久删除该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const response = await projectStore.deleteProject(projectId, { toGetted: false })
        if (response.code === 20000) return true
        console.warn('[ProjectHandlers] removeProjectPermanently:', response.message)
        return false
    } catch (error) {
        console.warn('[ProjectHandlers] removeProjectPermanently:', error)
        return false
    }
}