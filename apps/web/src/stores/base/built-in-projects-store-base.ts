import { computed, ref } from 'vue'
import type { BuiltInProjectViewObject } from '@nao-todo/types'

const useBuiltInProjectsStoreBase = () => {
    // @state 内建清单列表
    const builtInProjects = ref<BuiltInProjectViewObject[]>([])

    // @computed 内建清单列表 Map
    const builtInProjectsMap = computed(
        () => new Map(builtInProjects.value.map((project) => [project.id, project]))
    )

    // @method 设置内建清单
    const setBuiltInProjects = (projects: BuiltInProjectViewObject[]) => {
        builtInProjects.value = projects
    }

    // @method 获取单个内建清单
    const getBuiltInProject = (id: string) => {
        return builtInProjectsMap.value.get(id)
    }

    // @method 替换单个内建清单
    const setBuiltInProject = (id: string, newProject: BuiltInProjectViewObject) => {
        const index = builtInProjects.value.findIndex((project) => project.id === id)
        if (index === -1) return
        builtInProjects.value[index] = newProject
    }

    // @method 更新单个内建清单
    const updateBuiltInProject = (id: string, updateOptions: Partial<BuiltInProjectViewObject>) => {
        const oldProject = builtInProjectsMap.value.get(id)
        if (!oldProject) return
        setBuiltInProject(id, { ...oldProject, ...updateOptions })
    }

    // @return
    return {
        builtInProjects,
        setBuiltInProjects,
        getBuiltInProject,
        updateBuiltInProject,
        setBuiltInProject
    }
}

export default useBuiltInProjectsStoreBase
export type BuiltInProjectsStoreBase = ReturnType<typeof useBuiltInProjectsStoreBase>
