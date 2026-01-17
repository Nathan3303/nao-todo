import { reactive } from 'vue'
import type { BuiltInProjectApp } from '@nao-todo/application/project'
import type { Go } from '@nao-todo/types'

export type UseBuiltInProjectLoaderVO = {
    loading: boolean
    error: {
        message: string
        errorImage: string
    }
}

const useBuiltInProjectLoader = (builtInProjectApp: BuiltInProjectApp) => {
    // @states
    const states = reactive<UseBuiltInProjectLoaderVO>({
        loading: false,
        error: {
            message: '',
            errorImage: '/images/error.png'
        }
    })

    // @method 加载清单详情
    const loadProjectById = (projectId: string): Go<void> => {
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
        const [, err] = builtInProjectApp.getBuiltInProjectById(projectId)
        states.loading = false
        if (err !== null) {
            states.error.message = '清单详情加载失败'
            return states.error.message
        }
        return null
    }

    // @method 加载清单偏好
    const loadProjectPreferenceById = (userId: string, projectId: string): Go<void> => {
        // 1. 校验参数
        if (!projectId) {
            states.error.message = '参数错误'
            return states.error.message
        }
        // 2. 获取清单偏好
        states.loading = true
        states.error = {
            message: '',
            errorImage: ''
        }
        const [, err] = builtInProjectApp.getBuiltInProjectPreference(userId, projectId)
        states.loading = false
        if (err !== null) {
            states.error.message = '清单偏好数据获取失败'
            return states.error.message
        }
        return null
    }

    // @method 加载
    const load = (userId: string, projectId: string): Go<void> => {
        const err = loadProjectById(projectId)
        if (err !== null) return err
        const err2 = loadProjectPreferenceById(userId, projectId)
        // console.log(builtInProjectApp.states.preference)
        if (err2 !== null) return err2
        return null
    }

    // @method 重置状态
    const reset = () => {
        states.loading = true
        states.error = {
            message: '',
            errorImage: '/images/error.png'
        }
    }

    // @method 重新加载清单详情和偏好
    const reload = (userId: string, projectId: string): Go<void> => {
        reset()
        return load(userId, projectId)
    }

    // @returns
    return {
        states,
        loadProjectById,
        loadProjectPreferenceById,
        load,
        reset,
        reload
    }
}

export default useBuiltInProjectLoader
