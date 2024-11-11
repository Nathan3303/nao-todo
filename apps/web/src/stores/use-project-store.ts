import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createProject, deleteProject, updateProject, getProjects } from '@nao-todo/apis'
import type {
    Project,
    CreateProjectOptions,
    UpdateProjectOptions,
    UpdateProjectOptionsRaw,
    GetProjectsOptions
} from '@nao-todo/types'

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])

    // 获取选项
    const getOptions = ref<GetProjectsOptions>({
        page: 1,
        limit: 10,
        sort: { field: 'createdAt', order: 'desc' }
    })

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
    }

    // 更新清单
    const doUpdateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
        const result = await updateProject(projectId, options)
        if (result.code !== 20000) return false
        const index = projects.value.findIndex((project) => project.id === projectId)
        if (index === -1) return false
        const project = projects.value[index]
        const projectKeys = Object.keys(project)
        for (const key in projectKeys) {
            if (!(key in options)) continue
            project[key as keyof Project] = options[key as keyof UpdateProjectOptionsRaw] as never
        }
    }

    // 获取清单
    const doGetProjects = async () => {
        const result = await getProjects(getOptions.value)
        if (result.code !== 20000) return false
        projects.value = result.data as Project[]
    }

    // 删除清单
    const doDeleteProject = async (projectId: Project['id']) => {
        const result = await deleteProject(projectId)
        if (result.code !== 20000) return false
        const index = projects.value.findIndex((project) => project.id === projectId)
        // const deletedProject = { ...projects.value[index] } as Project
        if (index !== -1) projects.value.splice(index, 1)
        return true
    }

    return {
        projects,
        smartListData,
        doCreateProject,
        doUpdateProject,
        doGetProjects,
        doDeleteProject
    }
})
