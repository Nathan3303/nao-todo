import { defineStore } from 'pinia'
import { ref } from 'vue'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import type { Err, GetProjectsOptions, Project, UpdateProjectOptions } from '@nao-todo/types'
import {
    createProjectHandler,
    deleteProjectHandler,
    getProjectsHandler,
    restoreProjectHandler,
    updateProjectHandler
} from '@nao-todo/handlers/v1'

const useProjectStore = defineStore('ProjectStore', () => {
    // @state 清单列表（应该被应用于整个视图）
    const projects = ref<Project[]>([])

    // @method 获取清单列表
    const getProjects = async (options: GetProjectsOptions): Promise<Err> => {
        // 获取清单列表
        const [res, err] = await getProjectsHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        projects.value = res
        return null
    }

    // @method 创建清单
    const createProject = async (
        name: Project['name'],
        description?: Project['description']
    ): Promise<Err> => {
        // 参数判断
        if (!name) return '清单名称不能为空'
        // 创建清单
        const [res, err] = await createProjectHandler({ name: name, description }, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        projects.value.push(res)
        return null
    }

    // @method 删除清单
    const deleteProject = async (projectId: Project['id']): Promise<Err> => {
        // 参数判断
        if (!projectId) return '清单ID不能为空'
        // 删除清单
        const [, err] = await deleteProjectHandler(projectId, false, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        // projects.value = projects.value.filter((project) => project.id !== projectId)
        projects.value.forEach((project) => {
            if (project.id === projectId) {
                project.isDeleted = true
            }
        })
        return null
    }

    // @method 恢复清单
    const restoreProject = async (projectId: Project['id']): Promise<Err> => {
        // 参数判断
        if (!projectId) return '清单ID不能为空'
        // 删除清单
        const [, err] = await restoreProjectHandler(projectId, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        // projects.value = projects.value.filter((project) => project.id !== projectId)
        projects.value.forEach((project) => {
            if (project.id === projectId) {
                project.isDeleted = false
            }
        })
        return null
    }

    // @method 永久删除清单
    const deleteProjectPermanently = async (projectId: Project['id']): Promise<Err> => {
        // 参数判断
        if (!projectId) return '清单ID不能为空'
        // 删除清单
        const [, err] = await deleteProjectHandler(projectId, true, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        projects.value = projects.value.filter((project) => project.id !== projectId)
        return null
    }

    // @method 删除清单（带确认）
    const deleteProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '删除清单',
            content: '确定要删除此清单吗？',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const err = await deleteProject(projectId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('删除成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 恢复清单（带确认）
    const restoreProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '恢复清单',
            content: '要恢复此清单吗？',
            confirmButtonText: '恢复',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const err = await restoreProject(projectId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('恢复成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 永久删除清单（带确认）
    const deleteProjectPermanentlyWithConfirm = async (projectId: Project['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '永久删除清单',
            content: '确定要永久删除此清单吗？永久删除清单会删除归属于该清单的所有任务',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            theme: 'danger',
            onConfirm: async () => {
                const err = await deleteProjectPermanently(projectId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('永久删除成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 更新清单
    const updateProject = async (
        projectId: Project['id'],
        options: UpdateProjectOptions
    ): Promise<Err> => {
        // 参数判断
        if (!projectId) return '清单ID不能为空'
        if (options.name === '') return '清单名称不能为空'
        // 更新清单
        const [, err] = await updateProjectHandler(projectId, options, requester)
        // 处理失败结果
        if (err) {
            NueMessage.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        projects.value.forEach((project) => {
            if (project.id !== projectId) return
            if (options.name) project.name = options.name
            if (options.description) project.description = options.description
        })
        NueMessage.success('清单更新成功')
        return null
    }

    // @returns
    return {
        projects,
        getProjects,
        createProject,
        deleteProject,
        restoreProject,
        deleteProjectPermanently,
        deleteProjectWithConfirm,
        restoreProjectWithConfirm,
        deleteProjectPermanentlyWithConfirm,
        updateProject
    }
})

export default useProjectStore
