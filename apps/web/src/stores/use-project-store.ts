import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createProject, deleteProject, updateProject, getProjects } from '@nao-todo/apis'
import type {
    Project,
    CreateProjectOptions,
    UpdateProjectOptions,
    UpdateProjectOptionsRaw,
    GetProjectsOptions,
    ProjectPreference,
    GetProjectsOptionsRaw
} from '@nao-todo/types'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])

    // 获取选项
    const getOptions = ref<GetProjectsOptions>({
        page: 1,
        limit: 99,
        sort: { field: 'createdAt', order: 'desc' }
    })

    // 修改获取选项
    const updateGetOptions = (newOptions: Partial<GetProjectsOptions>) => {
        Object.assign(getOptions.value, newOptions)
    }

    // 智能清单列表
    const smartListData = computed<Project[]>(() => {
        return projects.value.filter((project) => {
            return !project.isDeleted && !project.isArchived
        })
    })

    // 添加清单
    const doCreateProject = async (options: CreateProjectOptions) => {
        const result = await createProject(options)
        if (result.code !== 20000) return false
        const newProject = result.data as Project
        console.log('[UseProjectStore] doCreateProject:', newProject)
        projects.value.push(newProject)
        return true
    }

    // 更新清单
    const doUpdateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
        const result = await updateProject(projectId, options)
        if (result.code !== 20000) return false
        const index = projects.value.findIndex((project) => project.id === projectId)
        if (index === -1) return false
        Object.keys(projects.value[index]).forEach((key) => {
            if (key in options) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                projects.value[index][key] = options[key as keyof UpdateProjectOptionsRaw]
            }
        })
        return true
    }

    // 获取清单
    const doGetProjects = async () => {
        const result = await getProjects(getOptions.value)
        if (result.code !== 20000) return false
        projects.value = result.data as Project[]
        return true
    }

    // 删除清单
    const doDeleteProject = async (projectId: Project['id']) => {
        const result = await deleteProject(projectId)
        if (result.code !== 20000) return false
        const index = projects.value.findIndex((project) => project.id === projectId)
        if (index !== -1) projects.value.splice(index, 1)
        return true
    }

    // 修改清单名称
    const updateProjectTitleWithPromt = async (
        projectId: Project['id'],
        currentTitle: Project['title']
    ) => {
        try {
            const newTitle = await NuePrompt({
                title: '修改清单名称',
                placeholder: '请输入新的清单名称',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentTitle,
                validator: (value: string) => value
            })
            const updateOptions = { title: newTitle } as UpdateProjectOptions
            if (await doUpdateProject(projectId, updateOptions)) {
                NueMessage.success('清单名称修改成功')
                return true
            } else {
                throw new Error('update project title failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] updateProjectTitleWithPromt:', error)
            NueMessage.error('清单名称修改失败')
            return false
        }
    }

    // 修改清单描述
    const updateProjectDescriptionWithPromt = async (
        projectId: Project['id'],
        currentDescription: Project['description']
    ) => {
        try {
            const newDescription = await NuePrompt({
                title: '修改清单描述',
                placeholder: '请输入新的清单描述',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentDescription,
                validator: (value: string) => value
            })
            const updateOptions = { description: newDescription } as UpdateProjectOptions
            const result = await doUpdateProject(projectId, updateOptions)
            if (result) {
                NueMessage.success('清单描述修改成功')
                return true
            } else {
                throw new Error('update project description failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] updateProjectDescriptionWithPromt:', error)
            NueMessage.error('清单描述修改失败')
            return false
        }
    }

    // 更新指定清单的偏好设置
    const updateProjectPreference = async (
        projectId: Project['id'],
        newPreference: Partial<ProjectPreference>
    ) => {
        const targetProjectIndex = projects.value.findIndex((project) => project.id === projectId)
        const targetProject = projects.value[targetProjectIndex]
        const oldPreference = targetProject.preference
        const updateOptions = { preference: { ...oldPreference, ...newPreference } }
        const result = await doUpdateProject(projectId, updateOptions)
        if (result) {
            NueMessage.success('清单偏好设置修改成功')
        } else {
            NueMessage.error('清单偏好设置修改失败')
        }
        return result
    }

    // 删除指定清单（带确认）
    const removeProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '删除清单确认',
                content: '确认删除该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isDeleted: true, deletedAt: Date.now() }
            const result = await doUpdateProject(projectId, updateOptions)
            if (result) {
                NueMessage.success('清单删除成功')
                return true
            } else {
                throw new Error('delete project failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] removeProjectWithConfirmation:', error)
            NueMessage.error('清单删除失败')
            return false
        }
    }

    // 恢复指定清单（带确认）
    const restoreProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '恢复清单确认',
                content: '确认恢复该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isDeleted: false, deletedAt: null }
            const result = await doUpdateProject(projectId, updateOptions)
            if (result) {
                NueMessage.success('清单恢复成功')
                return true
            } else {
                throw new Error('restore project failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] restoreProjectWithConfirmation:', error)
            NueMessage.error('清单恢复失败')
            return false
        }
    }

    // 归档指定清单（带确认）
    const archiveProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '归档清单确认',
                content: '确认归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isArchived: true, archivedAt: Date.now() }
            const result = await doUpdateProject(projectId, updateOptions)
            if (result) {
                NueMessage.success('清单归档成功')
                return true
            } else {
                throw new Error('archive project failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] archiveProjectWithConfirmation:', error)
            NueMessage.error('清单归档失败')
            return false
        }
    }

    // 取消归档指定清单（带确认）
    const unarchiveProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '取消归档清单确认',
                content: '确认取消归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isArchived: false, archivedAt: null }
            const result = await doUpdateProject(projectId, updateOptions)
            if (result) {
                NueMessage.success('清单取消归档成功')
                return true
            } else {
                throw new Error('unarchive project failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] unarchiveProjectWithConfirmation:', error)
            NueMessage.error('清单取消归档失败')
            return false
        }
    }

    // 永久删除指定清单（带确认）
    const removeProjectPermanently = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '永久删除清单确认',
                content: '确认永久删除该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const result = await doDeleteProject(projectId)
            if (result) {
                NueMessage.success('清单永久删除成功')
                return true
            } else {
                throw new Error('remove project permanently failed')
            }
        } catch (error) {
            console.warn('[UseProjectStore] removeProjectPermanently:', error)
            NueMessage.error('清单永久删除失败')
            return false
        }
    }

    // 获取本地清单
    const getProjectByIdFromLocal = (projectId: Project['id']) => {
        return projects.value.find((project) => project.id === projectId)
    }
    const findProjectsFromLocal = (options: GetProjectsOptionsRaw) => {
        return projects.value.filter((project) => {
            return Object.keys(options).every((key) => {
                return (
                    project[key as keyof Omit<GetProjectsOptionsRaw, 'sort'>] ===
                    options[key as keyof GetProjectsOptionsRaw]
                )
            })
        })
    }

    return {
        projects,
        getOptions,
        updateGetOptions,
        smartListData,
        doCreateProject,
        doUpdateProject,
        doGetProjects,
        doDeleteProject,
        updateProjectTitleWithPromt,
        updateProjectDescriptionWithPromt,
        updateProjectPreference,
        removeProjectWithConfirmation,
        restoreProjectWithConfirmation,
        archiveProjectWithConfirmation,
        unarchiveProjectWithConfirmation,
        removeProjectPermanently,
        getProjectByIdFromLocal,
        findProjectsFromLocal
    }
})
