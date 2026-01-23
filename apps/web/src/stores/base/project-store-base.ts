import type { Project } from '@nao-todo/types'
import { ref } from 'vue'

const useProjectStoreBase = () => {
    // @state 项目视图对象 Map
    const projects = ref<Map<string, Project>>(new Map())

    // @action 设置项目视图对象数组
    const setProjects = (value: Project[]) => {
        projects.value = new Map(value.map((item) => [item.id, item]))
    }

    // @action 添加项目
    const addProject = (p: Project) => {
        const idx = projects.value.has(p.id)
        if (idx) return
        projects.value.set(p.id, p)
    }

    // @action 获取项目
    const getProject = (id: string) => {
        return projects.value.get(id)
    }

    // @returns
    return {
        projects,
        setProjects,
        addProject,
        getProject
    }
}

export default useProjectStoreBase
export type ProjectStoreBase = ReturnType<typeof useProjectStoreBase>
