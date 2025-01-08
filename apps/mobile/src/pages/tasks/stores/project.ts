import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { GetProjectsOptions, GetProjectsSortOptions, Project } from '@nao-todo/types'
import { projectStoreDefaults } from '@/pages/tasks/constants'
import { stringifyGetOptions } from '@nao-todo/utils'
import { doRequest } from '@/pages/tasks/stores/do-request'
import { ApiBaseURL } from '@/constants'

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])

    // 获取选项
    const getOptions = shallowRef<GetProjectsOptions>(projectStoreDefaults.getOptions)

    // 智能清单列表
    const smartListData = computed<Project[]>(() => {
        return projects.value.filter((project) => {
            return !project.isDeleted && !project.isArchived
        })
    })

    const getProjects = async () => {
        const queryString = stringifyGetOptions(getOptions.value, (key, value) => {
            if (key === 'sort' && value) {
                return `${key}=${(value as GetProjectsSortOptions).field}:${(value as GetProjectsSortOptions).order}`
            }
        })
        // 调用getProjects函数获取项目数据
        const result = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/projects?${queryString}`
        })
        // 检查返回结果的代码，如果不等于20000，则表示获取失败，返回false
        if (result.code !== 20000) return false
        // 将获取到的项目数据赋值给projects.value，并指定类型为Project数组，表示获取成功，返回true
        projects.value = result.data as Project[]
        return true
    }

    // 获取本地清单
    const getProjectByIdFromLocal = (projectId: Project['id']) => {
        return projects.value.find((project) => project.id === projectId) || null
    }

    return {
        projects,
        getOptions,
        smartListData,
        getProjects,
        getProjectByIdFromLocal
    }
})
