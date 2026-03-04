import type { BuiltInProjectApp } from '@nao-todo/application/project'
import type {
    GetTasksSortOptions,
    Go,
    ProjectPreference,
    Project,
    TaskColumnOptions
} from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

export interface BuiltInProjectHandlers {
    savePreference: (
        userId: string,
        projectId: Project['id'],
        preference: ProjectPreference
    ) => Go<void>
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (options: GetTasksSortOptions) => void
    clearSortOptions: () => void
}

const useBuiltInProjectHandlers = (builtInProjectApp: BuiltInProjectApp) => {
    // @method 更新清单偏好设置
    const savePreference = (
        userId: string,
        projectId: Project['id'],
        preference: ProjectPreference
    ): Go<void> => {
        // 1. 校验参数
        if (!projectId || !preference) {
            return '参数错误'
        }
        // 2. 更新清单偏好
        const err = builtInProjectApp.updateBuiltInProjectPreference(userId, projectId, preference)
        if (err !== null) {
            return '清单偏好更新失败' + unwrapError(err)
        }
        // 3. 更新成功
        return null
    }

    // @method 更新列选项
    const updateColumns = (key: string, value: boolean) => {
        if (!builtInProjectApp.states.preference) return
        const oldValue = (builtInProjectApp.states.preference.columns as Record<string, boolean>)[
            key
        ]
        if (oldValue === void 0 || oldValue === value) return
        ;(builtInProjectApp.states.preference.columns as Record<string, boolean>)[key] = value
        console.log('updateColumns', key, value)
    }

    // @method 更新排序选项
    const updateSortOptions = (options: GetTasksSortOptions) => {
        if (!builtInProjectApp.states.preference) return
        if (
            options.field === builtInProjectApp.states.preference.getTasksOptions.sort?.field &&
            options.order === builtInProjectApp.states.preference.getTasksOptions.sort?.order
        ) {
            builtInProjectApp.states.preference.getTasksOptions.sort = undefined
            return
        }
        builtInProjectApp.states.preference.getTasksOptions.sort = options
    }

    // @method 清除排序选项
    const clearSortOptions = () => {
        if (!builtInProjectApp.states.preference) return
        builtInProjectApp.states.preference.getTasksOptions.sort = {
            field: 'createdAt',
            order: 'desc'
        }
    }

    // @returns
    return {
        savePreference,
        updateColumns,
        updateSortOptions,
        clearSortOptions
    }
}

export default useBuiltInProjectHandlers
