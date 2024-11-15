import { computed, ref, shallowRef } from 'vue'
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
    const getOptions = shallowRef<GetProjectsOptions>({
        page: 1,
        limit: 99,
        sort: { field: 'createdAt', order: 'desc' }
    })

    // 修改获取选项
    const updateGetOptions = (newOptions: GetProjectsOptions) => {
        getOptions.value = newOptions
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
        // console.log('[UseProjectStore] doCreateProject:', newProject)
        projects.value.push(newProject)
        return true
    }

    // 更新清单
    const doUpdateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
        const result = await updateProject(projectId, options)
        if (result.code !== 20000) return false
        const index = projects.value.findIndex((project) => project.id === projectId)
        if (index === -1) return false
        const project = projects.value[index]
        Object.keys(project).forEach((key) => {
            if (options[key as keyof UpdateProjectOptionsRaw]) {
                project[key as keyof Project] = options[
                    key as keyof UpdateProjectOptionsRaw
                ] as never
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

    /**
     * 异步函数：通过用户提示更新项目标题
     *
     * 此函数用于显示一个提示对话框，让用户输入新的项目标题，并尝试更新项目标题
     * 如果更新成功，会显示成功消息；如果更新失败，会显示错误消息
     *
     * @param projectId 项目的唯一标识符
     * @param currentTitle 当前项目的标题，用作提示对话框的默认输入值
     * @returns 返回一个布尔值，表示项目标题是否更新成功
     */
    const updateProjectTitleWithPrompt = async (
        projectId: Project['id'],
        currentTitle: Project['title']
    ) => {
        try {
            // 显示用户提示对话框，让用户输入新的项目标题
            const newTitle = await NuePrompt({
                title: '修改清单名称',
                placeholder: '请输入新的清单名称',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentTitle,
                // 简单的验证器，确保输入值不为空
                validator: (value: string) => value
            })

            // 准备更新项目的参数
            const updateOptions = { title: newTitle } as UpdateProjectOptions

            // 尝试更新项目标题
            if (await doUpdateProject(projectId, updateOptions)) {
                // 如果更新成功，显示成功消息
                NueMessage.success('清单名称修改成功')
                return true
            } else {
                // 如果更新失败，显示错误消息
                NueMessage.error('清单名称修改失败')
            }
        } catch (error) {
            // 捕获异常并打印错误信息
            console.warn('[UseProjectStore] updateProjectTitleWithPromt:', error)
        }
        // 如果执行到此处，表示更新失败或出现异常，返回false
        return false
    }

    // 修改清单描述
    const updateProjectDescriptionWithPrompt = async (
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
                NueMessage.error('清单描述修改失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] updateProjectDescriptionWithPromt:', error)
        }
        return false
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
                NueMessage.error('清单删除失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] removeProjectWithConfirmation:', error)
        }
        return false
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
                NueMessage.error('清单恢复失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] restoreProjectWithConfirmation:', error)
        }
        return false
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
                NueMessage.error('清单归档失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] archiveProjectWithConfirmation:', error)
        }
        return false
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
                NueMessage.error('清单取消归档失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] unarchiveProjectWithConfirmation:', error)
        }
        return false
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
                NueMessage.error('清单永久删除失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] removeProjectPermanently:', error)
        }
        return false
    }

    // 获取本地清单
    const getProjectByIdFromLocal = (projectId: Project['id']) => {
        return projects.value.find((project) => project.id === projectId) || null
        // 返回响应式结构
        // const index = projects.value.findIndex((project) => project.id === projectId)
        // if (index === -1) return null
        // return projects.value[index]
    }

    // 获取本地清单(s)
    const findProjectsFromLocal = (
        options: GetProjectsOptionsRaw,
        predicate?: (
            key: string,
            project: Project,
            options: GetProjectsOptionsRaw
        ) => boolean | undefined
    ) => {
        return projects.value.filter((project) => {
            return Object.keys(options).every((key) => {
                if (predicate) {
                    const result = predicate(key as keyof GetProjectsOptionsRaw, project, options)
                    if (typeof result === 'boolean') return result
                }
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
        smartListData,
        updateGetOptions,
        doCreateProject,
        doUpdateProject,
        doGetProjects,
        doDeleteProject,
        updateProjectTitleWithPrompt,
        updateProjectDescriptionWithPrompt,
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
