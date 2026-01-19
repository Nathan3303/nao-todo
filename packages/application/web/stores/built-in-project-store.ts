import { defineStore } from 'pinia'
import type {
    BuiltInProject,
    BuiltInProjectPreference
} from '@nao-todo/infrastructure/built-in/project/types'
import { computed, ref } from 'vue'

const useBuiltInProjectStore = defineStore('BuiltInProjectStore', () => {
    // @state 内建项目列表
    const builtInProjectList = ref<BuiltInProject[]>([])

    // @action 设置内建项目列表
    const setBuiltInProjects = (builtInProjects: BuiltInProject[]) => {
        builtInProjectList.value = builtInProjects
    }

    // @state 内建项目偏好
    const builtInProjectPreference = ref<BuiltInProjectPreference>()

    // @action 设置内建项目偏好
    const setBuiltInProjectPreference = (preference: BuiltInProjectPreference) => {
        builtInProjectPreference.value = preference
    }

    // @returns
    return {
        list: computed(() => builtInProjectList.value),
        preference: computed(() => builtInProjectPreference.value),
        setBuiltInProjects,
        setBuiltInProjectPreference
    }
})

export default useBuiltInProjectStore
