import type { useTagsStore } from '@/stores'
import type { Go, GoAsync } from '@nao-todo/types'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import { t } from '@nao-todo/infrastructure/locales'
import {
    CreateTagViewObject,
    TagUseCase,
    TagViewObject,
    UpdateTagViewObject
} from '@nao-todo/usecases/tag'
import { GetTasksOptions, GetTasksSortOptions, TaskColumnOptions } from '@nao-todo/usecases/task'

export class TagHandler {
    /**
     * 标签操作器
     * @param tagUseCase 标签用例
     * @param tagsStore 标签存储
     * @param subscriber 事件订阅器
     */
    constructor(
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

    /**
     * 保存标签偏好设置
     * @param tagId 标签ID
     * @returns 无
     */
    async savePreference(tagId: string): GoAsync<void> {
        // 1. 获取当前偏好设置
        const preference = this.tagsStore.getTagPreference()
        if (!preference) return '标签偏好设置不存在'
        // console.log('savePreference', preference)
        // 2. 配置标签ID
        preference.tagId = tagId
        // 3. 调用用例
        return await this.tagUseCase.savePreference(tagId, preference)
    }

    /**
     * 创建标签
     * @param createVO 创建标签视图对象
     * @returns 错误或空
     */
    async createTag(createVO: CreateTagViewObject): GoAsync<void> {
        const [, err] = await this.tagUseCase.create(createVO)
        if (err !== null) {
            NueMessage.error(t('dialog.tagUpdateFailed', { error: unwrapError(err) }))
            return err
        }
        NueMessage.success(t('dialog.tagCreateSuccess'))
        return null
    }

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateVO 更新标签视图对象
     * @returns 错误或空
     */
    async updateTag(tagId: string, updateVO: UpdateTagViewObject): GoAsync<void> {
        const err = await this.tagUseCase.update(tagId, updateVO)
        if (err !== null) {
            NueMessage.error(t('dialog.tagUpdateFailed', { error: unwrapError(err) }))
            return err
        }
        NueMessage.success(t('dialog.tagUpdateSuccess'))
        return null
    }

    /**
     * 更新标签颜色
     * @param tagId 标签ID
     * @param color 颜色值
     * @returns 错误或空
     */
    async updateTagColor(tagId: string, color: string): GoAsync<void> {
        return await this.updateTag(tagId, { id: tagId, color })
    }

    /**
     * 删除标签
     * @param tagId 标签ID
     * @returns 错误或空
     */
    async deleteTag(tagId: string): GoAsync<void> {
        const [, isByCancel] = await NueConfirm({
            title: t('dialog.tagDeleteConfirmTitle'),
            content: t('dialog.tagDeleteConfirmContent'),
            confirmButtonText: t('dialog.confirmDelete'),
            cancelButtonText: t('common.cancel')
        })
        if (isByCancel) return 'Cancel'
        const err = await this.tagUseCase.delete(tagId)
        if (err !== null) {
            NueMessage.error(t('dialog.tagDeleteFailed', { error: unwrapError(err) }))
            return err
        }
        NueMessage.success(t('dialog.tagDeleteSuccess'))
        return null
    }

    /**
     * 获取标签颜色
     * @param id 标签ID
     * @returns 标签颜色
     */
    getTagColor(id: TagViewObject['id']): TagViewObject['color'] {
        return this.tagsStore.tags.find((tag) => tag.id === id)?.color || 'transparent'
    }
}

