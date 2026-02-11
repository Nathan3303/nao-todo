import { useTagsStore } from '@/stores/tasks'
import type { GetTasksOptions, GetTasksSortOptions, Go, TaskColumnOptions } from '@nao-todo/types'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { TagUseCase } from '@nao-todo/application/web/usecases/tag'

export class TagHandler {
    /**
     * 标签操作器
     * @param taskUseCase 任务用例
     * @param tagUseCase 标签用例
     * @param tagsStore 标签存储
     */
    constructor(
        private taskUseCase: TaskUseCase,
        private tagUseCase: TagUseCase,
        private tagsStore: ReturnType<typeof useTagsStore>,
        private subscriber: Subscriber
    ) {}

    /**
     * 更新标签列配置
     * @param key 配置键
     * @param value 配置值
     * @returns 无
     */
    updateColumns(key: keyof TaskColumnOptions, value: boolean): Go<void> {
        // 1. 调用存储
        this.tagsStore.updatePreferenceColumns(key, value)
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 更新标签获取任务选项
     * @param key 选项键
     * @param value 选项值
     * @returns 无
     */
    updateGetTasksOptions<K extends keyof GetTasksOptions>(
        key: K,
        value: GetTasksOptions[K]
    ): Go<void> {
        // 1. 调用存储
        this.tagsStore.updatePreferenceGetTasksOptions(key, value)
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 更新标签排序选项
     * @param field 排序字段
     * @param order 排序顺序 - 降序或升序
     * @returns 无
     */
    updateSortOption(
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): Go<void> {
        // 1. 调用存储
        this.tagsStore.updatePreferenceGetTasksOptions('sort', { field, order })
        // 2. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 3. 返回
        return null
    }

    /**
     * 清除标签排序选项
     * @returns 无
     */
    clearSortOption(): Go<void> {
        // 1. 调用存储
        this.tagsStore.updatePreferenceGetTasksOptions('sort', { field: 'created', order: 'desc' })
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
        const currentState = this.tagsStore.getPreferenceGetTasksOption('state')
        // 2. 判断是否已隐藏 - 已隐藏则显示, 否则隐藏
        if (currentState === 'todo,in-progress') {
            this.tagsStore.updatePreferenceGetTasksOptions('state', '')
        } else {
            this.tagsStore.updatePreferenceGetTasksOptions('state', 'todo,in-progress')
        }
        // 3. 触发刷新数据事件
        this.subscriber.emit('RefreshData')
        // 4. 返回
        return null
    }
}
