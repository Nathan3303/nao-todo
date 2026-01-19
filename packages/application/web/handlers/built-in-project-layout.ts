import { GetTasksOptions, GetTasksSortOptions, Go } from '@nao-todo/types'
// import { BuiltInProjectUseCase } from '../usecases/built-in-project'
import { TaskUseCase } from '../usecases/task'

export interface BuiltInProjectStore {
    updatePreferenceColumns(key: string, value: boolean): void
    updatePreferenceGetOption(key: string, value: unknown): void
    updateGetTasksOptions<K extends keyof GetTasksOptions>(
        key: K,
        value: GetTasksOptions[K]
    ): Go<void>
    getPreferenceGetOption(key: string): unknown
    getPreferenceGetOptions(): GetTasksOptions
}

export class BuiltInProjectLayoutHandlers {
    /**
     * 项目内建处理程序
     * @param builtInProjectUseCase 项目内建用例
     * @param store 项目内建处理程序存储
     */
    constructor(
        // private builtInProjectUseCase: BuiltInProjectUseCase, 
        private taskUseCase: TaskUseCase,
        private store: BuiltInProjectStore
    ) {}

    /**
     * 更新项目内建列配置
     * @param key 配置键
     * @param value 配置值
     * @returns 无
     */
    updateColumns(key: string, value: boolean): Go<void> {
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
        this.store.updateGetTasksOptions(key, value)
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
        this.store.updateGetTasksOptions('sort', { field, order })
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
        const currentState = this.store.getPreferenceGetOption('state')
        // 2. 判断是否已隐藏 - 已隐藏则显示, 否则隐藏
        if (currentState === 'todo,in-progress') {
            this.store.updatePreferenceGetOption('state', '')
        } else {
            this.store.updatePreferenceGetOption('state', 'todo,in-progress')
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
        this.taskUseCase.loadTasks(this.store.getPreferenceGetOptions())
        // 2. 返回
        return null
    }
}
