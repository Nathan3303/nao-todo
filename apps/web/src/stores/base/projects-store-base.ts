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
    const getAllProjects = () => {
        return projects
    }

    // @action 添加项目
    const addProject = (p: ProjectViewObject) => {
        // if (projectsMap.value.has(p.id)) return
        projects.push(p)
        console.log('addProject', projects, p)
    }

    // @action 获取项目
    const getProject = (id: string) => {
        return projectsMap.value.get(id)
    }

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
        deleteProject
    }
}

export default useProjectsStoreBase
export type ProjectsStoreBase = ReturnType<typeof useProjectsStoreBase>
