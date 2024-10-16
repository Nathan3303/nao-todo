/*
    设计：
    - 根据路由创建，如：all，$p66d6f7114ae76057cfaa35a9 等。
    - 保存视图形式、筛选信息以及列设置等信息。
    - 从路由守卫上做工作，当进入路由后读取预设信息并显示内容。
    - 通过指定的设置对话框修改预设信息。
    - 根据 id 获取预设信息，若没有则创建新预设

    流程：
    - 通过 useViewSettings 获取预设信息，视图 id 作为获取参数。
    - 解构并使用预设信息，如 { type, filterInfo, columns, sortInfo } 
    - 解构并使用内部方法，如 { read, save }
*/
import { reactive } from 'vue'
import type { ViewSettings } from './types'

const LSPrefix = 'v4s8_'

const readViewSettings = (viewId: string) => {
    const settings = localStorage.getItem(LSPrefix + viewId)
    return settings ? JSON.parse(settings) : null
}

export const useViewSettings = (viewId: string) => {
    const settings = reactive<ViewSettings>({
        type: 'table',
        filterInfo: {},
        columns: {
            state: true,
            priority: true,
            description: false,
            endAt: false,
            createdAt: false,
            updatedAt: false,
            project: false
        },
        sortInfo: {
            field: 'createdAt',
            order: 'desc'
        }
    })

    const read = () => {
        const _settings = readViewSettings(viewId)
        if (_settings) {
            Object.assign(settings, _settings)
        }
    }

    const save = () => {
        const _settings = { ...settings }
        localStorage.setItem(LSPrefix + viewId, JSON.stringify(_settings))
    }

    return {
        settings,
        read,
        save
    }
}

export type { ViewSettings }
