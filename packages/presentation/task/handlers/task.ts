import { t, type GoAsync, type GoError, type LocaleKey, type Subscriber } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { NueConfirm, NueMessage } from 'nue-ui'
import {
    TaskUseCase,
    type CreateTaskViewObject,
    type TaskViewObject,
    type UpdateTaskViewObject
} from '@nao-todo/domain-task'
import { translateTaskError } from '../utils/error-message'

/**
 * 任务操作器
 */
export class TaskHandler {
    /**
     * 任务操作器
     * @param taskUseCase 任务用例
     * @param subscriber 订阅器
     */
    constructor(
        private taskUseCase: TaskUseCase,
        private subscriber: Subscriber
    ) {}

    /**
     * 静默模式
     * @description 批量操作时置为 true，由调用方统一汇总提示，避免逐条消息刷屏
     */
    silent = false

    /**
     * 错误提示
     * @param key 错误文案键
     * @param error 错误对象
     */
    private notifyError(key: LocaleKey, error: unknown) {
        if (this.silent) return
        NueMessage.error(t(key, { error: `(${translateTaskError(error as GoError)})` }))
    }

    /**
     * 成功提示
     * @param key 成功文案键
     */
    private notifySuccess(key: LocaleKey) {
        if (this.silent) return
        NueMessage.success(t(key))
    }

    /**
     * 创建任务
     * @param createViewObject 创建任务视图对象
     * @returns 任务视图对象
     */
    async create(createViewObject: CreateTaskViewObject): GoAsync<void> {
        const [, createError] = await this.taskUseCase.create(createViewObject)
        if (createError !== null) {
            this.notifyError('task.createFailed', createError)
            return createError
        }
        this.notifySuccess('task.createSuccess')
        return null
    }

    /**
     * 更新任务
     * @param id 任务 ID
     * @param updateViewObject 更新任务视图对象
     * @returns 任务视图对象
     */
    async update(id: TaskViewObject['id'], updateViewObject: UpdateTaskViewObject): GoAsync<void> {
        const updateError = await this.taskUseCase.update(id, {
            ...updateViewObject,
            // 更新时间
            updatedAt: dayjs().toISOString()
        })
        if (updateError !== null) {
            this.notifyError('task.updateFailed', updateError)
            return updateError
        }
        this.notifySuccess('task.updateSuccess')
        return null
    }

    /**
     * 更新任务名称
     * @param id 任务 ID
     * @param name 任务名称
     * @returns 任务视图对象
     */
    async updateTaskName(id: TaskViewObject['id'], name: TaskViewObject['name']): GoAsync<void> {
        return await this.update(id, { name })
    }

    /**
     * 更新任务描述
     * @param id 任务 ID
     * @param description 任务描述
     * @returns 任务视图对象
     */
    async updateTaskDescription(
        id: TaskViewObject['id'],
        description: TaskViewObject['description']
    ): GoAsync<void> {
        return await this.update(id, { description })
    }

    /**
     * 更新任务状态
     * @param id 任务 ID
     * @param state 任务状态
     * @returns 任务视图对象
     */
    async updateTaskState(id: TaskViewObject['id'], state: TaskViewObject['state']): GoAsync<void> {
        return await this.update(id, { state })
    }

    /**
     * 更新任务优先级
     * @param id 任务 ID
     * @param priority 任务优先级
     * @returns 任务视图对象
     */
    async updateTaskPriority(
        id: TaskViewObject['id'],
        priority: TaskViewObject['priority']
    ): GoAsync<void> {
        return await this.update(id, { priority })
    }

    /**
     * 更新任务结束时间
     * @param id 任务 ID
     * @param endAt 任务结束时间
     * @returns 任务视图对象
     */
    async updateTaskEndAt(id: TaskViewObject['id'], endAt: TaskViewObject['endAt']): GoAsync<void> {
        return await this.update(id, { endAt })
    }

    /**
     * 删除任务
     * @param id 任务 ID
     * @returns 任务视图对象
     */
    async delete(id: TaskViewObject['id']): GoAsync<void> {
        const deleteError = await this.taskUseCase.delete(id)
        if (deleteError !== null) {
            this.notifyError('task.deleteFailed', deleteError)
            return deleteError
        }
        this.notifySuccess('task.deleteSuccess')
        return null
    }

    /**
     * 恢复任务
     * @param id 任务 ID
     * @returns 任务视图对象
     */
    async restore(id: TaskViewObject['id']): GoAsync<void> {
        const restoreError = await this.taskUseCase.restore(id)
        if (restoreError !== null) {
            this.notifyError('task.restoreFailed', restoreError)
            return restoreError
        }
        this.notifySuccess('task.restoreSuccess')
        return null
    }

    /**
     * 任务放弃
     * @param id 任务 ID
     * @returns 任务视图对象
     */
    async giveUp(id: TaskViewObject['id']) {
        NueConfirm({
            title: t('task.confirmGiveUpTitle'),
            content: t('task.confirmGiveUpContent'),
            confirmButtonText: t('task.confirmGiveUp'),
            cancelButtonText: t('common.cancel'),
            onConfirm: async () => {
                const updateError = await this.taskUseCase.update(id, {
                    givenUpAt: dayjs().toISOString()
                })
                if (updateError !== null) {
                    this.notifyError('task.updateFailed', updateError)
                    return updateError
                }
                this.notifySuccess('task.updateSuccess')
                return null
            }
        })
    }

    /**
     * 任务取消放弃
     * @param id 任务 ID
     * @returns 任务视图对象
     */
    async unGiveUp(id: TaskViewObject['id']): GoAsync<void> {
        return await this.update(id, { isGivenUp: false, givenUpAt: null })
    }

    /**
     * 复制任务
     * @param id 任务 ID
     * @param onSuccess 复制成功回调
     * @returns 任务视图对象
     */
    async copyTask(id: TaskViewObject['id'], onSuccess?: (taskViewObject: TaskViewObject) => void) {
        return NueConfirm({
            title: t('task.confirmCopyTitle'),
            content: t('task.confirmCopyContent'),
            confirmButtonText: t('task.confirmCopy'),
            cancelButtonText: t('common.cancel'),
            onConfirm: async () => {
                const [taskViewObject, err] = await this.taskUseCase.copy(id)
                if (err !== null) {
                    this.notifyError('task.copyFailed', err)
                    return
                }
                this.notifySuccess('task.copySuccess')
                this.subscriber.emit('AddNewTaskId', taskViewObject.id)
                onSuccess?.(taskViewObject)
            }
        })
    }
}