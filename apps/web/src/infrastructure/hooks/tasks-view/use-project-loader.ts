import { reactive } from 'vue'
import type { ProjectApp } from '@nao-todo/application/project/project-app'

export type UseProjectLoaderVO = {
    loading: boolean
    error: {
        message: string
        errorImage: string
    }
}

const useProjectLoader = (projectApp: ProjectApp) => {
    // @states
    const states = reactive<UseProjectLoaderVO>({
        loading: false,
        error: {
            message: '',
            errorImage: '/images/error.png'
        }
    })

    // @method 加载清单详情
    const loadProjectById = async (projectId: string) => {
        // 1. 校验参数
        if (!projectId) {
            states.error.message = '参数错误'
            return states.error.message
        }
        // 2. 获取清单详情
        states.loading = true
        states.error = {
            message: '',
            errorImage: ''
        }
        const [, err] = await projectApp.getById(projectId)
        if (err !== null) {
            states.error.message = '清单数据获取失败'
            return
        }
        states.loading = false
        states.error.message = ''
    }

    // @method 加载清单偏好
    const loadProjectPreferenceById = async (projectId: string) => {
        // 1. 校验参数
        if (!projectId) {
            states.error.message = '参数错误'
            return states.error.message
        }
        // 2. 获取清单偏好
        states.loading = true
        states.error.message = ''
        const [, err] = await projectApp.getPreference(projectId)
        if (err !== null) {
            states.error.message = '清单偏好数据获取失败'
            return
        }
        states.loading = false
        states.error.message = ''
        return
    }

    // @method 加载
    const load = async (projectId: string) => {
        await loadProjectById(projectId)
        await loadProjectPreferenceById(projectId)
    }

    // @method 重置状态
    const reset = () => {
        states.loading = true
        states.error = {
            message: '',
            errorImage: '/images/error.png'
        }
    }

    // @returns
    return {
        states,
        loadProjectById,
        loadProjectPreferenceById,
        load,
        reset
    }
}

export default useProjectLoader
