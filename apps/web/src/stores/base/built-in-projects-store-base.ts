import { ref } from 'vue'
import type { BuiltInProject } from '@nao-todo/types'

const useBuiltInProjectsStoreBase = () => {
    // @state 内建清单列表
    // const builtInProjects = ref<BuiltInProject[]>([])

    // @computed 内建清单列表 Map
    const builtInProjectsMap = ref<Map<BuiltInProject['id'], BuiltInProject>>(new Map())

    // @method 设置内建清单
    const setBuiltInProjects = (projects: BuiltInProject[]) => {
        // builtInProjects.value = projects
        builtInProjectsMap.value = new Map(projects.map((project) => [project.id, project]))
    }

    // @method 获取单个内建清单
    const getBuiltInProject = (id: string) => {
        return builtInProjectsMap.value.get(id)
    }

    // @return
    return { builtInProjects: builtInProjectsMap, setBuiltInProjects, getBuiltInProject }
}

export default useBuiltInProjectsStoreBase
export type BuiltInProjectsStoreBase = ReturnType<typeof useBuiltInProjectsStoreBase>
