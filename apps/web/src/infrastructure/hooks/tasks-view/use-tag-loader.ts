import { reactive } from 'vue'
import type { TagApp } from '@nao-todo/application/tag/tag-app'

export type UseTagLoaderVO = {
    loading: boolean
    error: {
        message: string
        errorImage: string
    }
}

const useTagLoader = (tagApp: TagApp) => {
    // @states
    const states = reactive<UseTagLoaderVO>({
        loading: false,
        error: {
            message: '',
            errorImage: '/images/error.png'
        }
    })

    // @method 加载标签详情
    const loadTagById = async (tagId: string) => {
        // 1. 校验参数
        if (!tagId) {
            states.error.message = '参数错误'
            return states.error.message
        }
        // 2. 获取标签详情
        states.loading = true
        states.error = {
            message: '',
            errorImage: ''
        }
        const [, err] = await tagApp.getById(tagId)
        if (err !== null) {
            states.error.message = '标签数据获取失败'
            return
        }
        states.loading = false
        states.error.message = ''
    }

    // @method 加载标签偏好
    const loadTagPreferenceById = async (tagId: string) => {
        // 1. 校验参数
        if (!tagId) {
            states.error.message = '参数错误'
            return states.error.message
        }
        // 2. 获取标签偏好
        states.loading = true
        states.error.message = ''
        const [, err] = await tagApp.getPreference(tagId)
        if (err !== null) {
            states.error.message = '标签偏好数据获取失败'
            return
        }
        states.loading = false
        states.error.message = ''
        return
    }

    // @method 加载标签
    const load = async (tagId: string) => {
        await loadTagById(tagId)
        await loadTagPreferenceById(tagId)
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
        loadTagById,
        loadTagPreferenceById,
        load,
        reset
    }
}

export default useTagLoader
