import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type {
    BuiltInProjectPreference,
    GetTasksOptions,
    GetTasksSortOptions,
    Go,
    TaskColumnOptions
} from '@nao-todo/types'
import type { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'

export interface BuiltInProjectStore {
    updatePreferenceColumns(key: keyof TaskColumnOptions, value: boolean): void
    updatePreferenceGetTasksOptions<T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ): void
    getPreferenceGetTasksOption<T extends keyof GetTasksOptions>(key: T): GetTasksOptions[T]
    getPreferenceGetTasksOptions(): GetTasksOptions
    getBuiltInProjectPreference: () => BuiltInProjectPreference | undefined
}

export class BuiltInProjectLayoutHandlers {
    /**
     * 项目内建处理程序
     * @param builtInProjectUseCase 项目内建用例
     * @param store 项目内建处理程序存储
     */
    constructor(
        private builtInProjectUseCase: BuiltInProjectUseCase,
        private taskUseCase: TaskUseCase,
        private store: BuiltInProjectStore
    ) {}

    /**
     * 更新项目内建列配置
     * @param key 配置键
     * @param value 配置值
     * @returns 无
     */
    updateColumns(key: keyof TaskColumnOptions, value: boolean): Go<void> {
        // 1. 调用存储
        this.store.updatePreferenceColumns(key, value)
        // 2. 返回
        return null
    }

    /**
     * 更新项目内建获取任务选项
     * @param key 选项键
     * @param value 选项值
     * @returns 无
     */
    updateGetTasksOptions<K extends keyof GetTasksOptions>(
        key: K,
        value: GetTasksOptions[K]
    ): Go<void> {
        // 1. 调用存储
        this.store.updatePreferenceGetTasksOptions(key, value)
        // 2. 调用任务用例重新获取任务数据
        this.reloadTasks()
        // 3. 返回
        return null
    }

    /**
     * 更新项目内建排序选项
     * @param field 排序字段
     * @param order 排序顺序 - 降序或升序
     * @returns 无
     */
    updateSortOption(
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): Go<void> {
        // 1. 调用存储
        this.store.updatePreferenceGetTasksOptions('sort', { field, order })
        // 2. 调用任务用例重新获取任务数据
        this.reloadTasks()
        // 3. 返回
        return null
    }

    /**
     * 清除项目内建排序选项
     * @returns 无
     */
    clearSortOption(): Go<void> {
        // 1. 调用存储
        this.store.updatePreferenceGetTasksOptions('sort', { field: 'created', order: 'desc' })
        // 2. 调用任务用例重新获取任务数据
        this.reloadTasks()
        // 3. 返回
        return null
    }

    /**
     * 切换已完成任务显示
     * @returns 无
     */
    switchCompletedTaskDisplay(): Go<void> {
        // 1. 获取当前状态
        const currentState = this.store.getPreferenceGetTasksOption('state')
        // 2. 判断是否已隐藏 - 已隐藏则显示, 否则隐藏
        if (currentState === 'todo,in-progress') {
            this.store.updatePreferenceGetTasksOptions('state', '')
        } else {
            this.store.updatePreferenceGetTasksOptions('state', 'todo,in-progress')
        }
        // 3. 调用任务用例重新获取任务数据
        this.reloadTasks()
        // 4. 返回
        return null
    }

    /**
     * 重新加载任务列表
     * @returns 无
     */
    reloadTasks(): Go<void> {
        // 1. 调用任务用例重新获取任务数据
        this.taskUseCase.loadTasks(this.store.getPreferenceGetTasksOptions())
        // 2. 返回
        return null
    }

    /**
     * 保存项目内建偏好
     * @param email 用户邮箱
     * @param projectId 项目ID
     * @param preference 项目内建偏好
     * @returns 无
     */
    savePreference(email: string, projectId: string): Go<void> {
        // 1. 获取最新的偏好设置
        const newPreference = this.store.getBuiltInProjectPreference()
        if (!newPreference) return '项目内建偏好不存在'
        // console.log('savePreference', newPreference)
        // 2. 配置项目ID
        newPreference.projectId = projectId
        // 3. 调用用例保存偏好
        return this.builtInProjectUseCase.savePreference(email, projectId, newPreference!)
    }
}
