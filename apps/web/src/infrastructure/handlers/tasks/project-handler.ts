import { useProjectsStore } from '@/stores/tasks'
import type {
    GetTasksOptions,
    GetTasksSortOptions,
    Go,
    GoAsync,
    TaskColumnOptions
} from '@nao-todo/types'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { ProjectUseCase } from '@nao-todo/application/web/usecases/project'

export class ProjectHandler {
    /**
     * 项目操作器
     * @param taskUseCase 任务用例
     * @param projectUseCase 项目用例
     * @param projectStore 项目存储
     * @param subscriber 事件订阅器
     */
    constructor(
        private taskUseCase: TaskUseCase,
        private projectUseCase: ProjectUseCase,
        private projectStore: ReturnType<typeof useProjectsStore>,
        private subscriber: Subscriber
    ) {}

    /**
     * 更新项目列配置
     * @param key 配置键
     * @param value 配置值
     * @returns 无
     */
    updateColumns(key: keyof TaskColumnOptions, value: boolean): Go<void> {
        // 1. 调用存储
        this.projectStore.updatePreferenceColumns(key, value)
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 更新项目获取任务选项
     * @param key 选项键
     * @param value 选项值
     * @returns 无
     */
    updateGetTasksOptions<K extends keyof GetTasksOptions>(
        key: K,
        value: GetTasksOptions[K]
    ): Go<void> {
        // 1. 调用存储
        this.projectStore.updatePreferenceGetTasksOptions(key, value)
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 更新项目排序选项
     * @param field 排序字段
     * @param order 排序顺序 - 降序或升序
     * @returns 无
     */
    updateSortOption(
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): Go<void> {
        // 1. 调用存储
        this.projectStore.updatePreferenceGetTasksOptions('sort', { field, order })
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 清除项目排序选项
     * @returns 无
     */
    clearSortOption(): Go<void> {
        // 1. 调用存储
        this.projectStore.updatePreferenceGetTasksOptions('sort', {
            field: 'created',
            order: 'desc'
        })
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 切换已完成任务显示
     * @returns 无
     */
    switchCompletedTaskDisplay(): Go<void> {
        // 1. 获取当前状态
        const currentState = this.projectStore.getPreferenceGetTasksOption('state')
        // 2. 判断是否已隐藏 - 已隐藏则显示, 否则隐藏
        if (currentState === 'todo,in-progress') {
            this.projectStore.updatePreferenceGetTasksOptions('state', '')
        } else {
            this.projectStore.updatePreferenceGetTasksOptions('state', 'todo,in-progress')
        }
        // 3. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 4. 返回
        return null
    }

    /**
     * 保存项目偏好设置
     * @param projectId 项目ID
     * @returns 无
     */
    async savePreference(projectId: string): GoAsync<void> {
        // 1. 获取当前偏好设置
        const preference = this.projectStore.getProjectPreference()
        if (!preference) return '项目偏好设置不存在'
        // console.log('savePreference', preference)
        // 2. 配置项目ID
        preference.projectId = projectId
        // 3. 调用用例
        return await this.projectUseCase.savePreference(projectId, preference)
    }
}

