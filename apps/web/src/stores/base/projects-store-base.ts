import type { ProjectViewObject, UpdateProjectViewObject } from '@nao-todo/types'
import { computed, reactive } from 'vue'

const useProjectsStoreBase = () => {
    // @state 项目视图对象数组
    const projects = reactive<ProjectViewObject[]>([])

    // @state 项目视图对象 Map
    const projectsMap = computed(() => new Map(projects.map((item) => [item.id, item])))

    // @action 设置项目视图对象数组
    const setProjects = (value: ProjectViewObject[]) => {
        projects.length = 0
        projects.push(...value)
    }

    // @action 获取所有项目
    const getAllProjects = () => projects

    // @action 获取项目
    const getProject = (id: string) => projectsMap.value.get(id)

    // @action 添加项目
    const addProject = (p: ProjectViewObject) => projects.push(p)

    // @action 设置项目
    const setProject = (id: string, p: ProjectViewObject) => {
        if (!projectsMap.value.has(id)) return
        const index = projects.findIndex((item) => item.id === id)
        if (index === -1) return
        projects[index] = p
    }

    // @action 更新项目
    const updateProject = (id: string, updateProjectViewObject: UpdateProjectViewObject) => {
        const oldProject = projectsMap.value.get(id)
        if (!oldProject) return
        setProject(id, { ...oldProject, ...updateProjectViewObject })
    }

    // @action 软删除项目
    const softDeleteProject = (id: string) => {
        const oldProject = projectsMap.value.get(id)
        if (!oldProject) return
        setProject(id, { ...oldProject, deactivedAt: new Date().toISOString(), isDeleted: true })
    }

    // @action 恢复项目
    const restoreProject = (id: string) => {
        const oldProject = projectsMap.value.get(id)
        if (!oldProject) return
        setProject(id, { ...oldProject, deactivedAt: '', isDeleted: false })
    }

    // @action 归档项目
    const archiveProject = (id: string) => {
        const oldProject = projectsMap.value.get(id)
        if (!oldProject) return
        setProject(id, { ...oldProject, isArchived: true })
    }

    // @action 取消归档项目
    const unarchiveProject = (id: string) => {
        const oldProject = projectsMap.value.get(id)
        if (!oldProject) return
        setProject(id, { ...oldProject, isArchived: false })
    }

    // @action 批量更新项目
    const updateProjects = (newProjects: ProjectViewObject[]) => {
        newProjects.forEach((p) => updateProject(p.id, p))
    }

    // @action 删除项目
    const deleteProject = (id: string) => {
        const index = projects.findIndex((item) => item.id === id)
        if (index === -1) return
        projects.splice(index, 1)
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

export default useProjectsStoreBase
export type ProjectsStoreBase = ReturnType<typeof useProjectsStoreBase>

