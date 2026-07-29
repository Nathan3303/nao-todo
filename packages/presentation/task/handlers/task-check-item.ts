import { t, unwrapErrors, type GoAsync, type Subscriber } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import type {
    CreateTaskCheckItemViewObject,
    TaskCheckItemViewObject,
    UpdateTaskCheckItemViewObject
} from '@nao-todo/domain-task/viewobjects'
import { TaskCheckItemUseCase } from '@nao-todo/domain-task/usecases'

/**
 * 任务检查项操作器
 */
export class TaskCheckItemHandler {
    /**
     * 任务检查项操作器
     * @param taskCheckItemUseCase 任务检查项用例
     * @param subscriber 事件订阅器
     */
    constructor(
        private taskCheckItemUseCase: TaskCheckItemUseCase,
        private subscriber: Subscriber
    ) {}

    /**
     * 创建任务检查项
     * @param createViewObject 创建任务检查项视图对象
     * @returns 无
     */
    async create(createViewObject: CreateTaskCheckItemViewObject): GoAsync<void> {
        const [, err] = await this.taskCheckItemUseCase.create(createViewObject)
        if (err !== null) {
            NueMessage.error(t('task.eventCreateFailed', { error: `(${unwrapErrors(err)})` }))
            return err
        }
        NueMessage.success(t('task.eventCreateSuccess'))
        return null
    }

    /**
     * 更新任务检查项
     * @param id 任务检查项ID
     * @param updateViewObject 更新任务检查项视图对象
     * @returns 无
     */
    async update(
        id: TaskCheckItemViewObject['id'],
        updateViewObject: UpdateTaskCheckItemViewObject
    ): GoAsync<void> {
        if (!id) return '参数错误'
        const updateError = await this.taskCheckItemUseCase.update(id, updateViewObject)
        if (updateError !== null) {
            NueMessage.error(
                t('task.eventUpdateFailed', { error: `(${unwrapErrors(updateError)})` })
            )
            return updateError
        }
        NueMessage.success(t('task.eventUpdateSuccess'))
        return null
    }

    /**
     * 删除任务检查项
     * @param id 任务检查项ID
     * @returns 无
     */
    async delete(id: TaskCheckItemViewObject['id']): GoAsync<void> {
        if (!id) return '参数错误'
        const [, deleteError] = await this.taskCheckItemUseCase.delete(id)
        if (deleteError !== null) {
            NueMessage.error(
                t('task.eventDeleteFailed', { error: `(${unwrapErrors(deleteError)})` })
            )
            return deleteError
        }
        NueMessage.success(t('task.eventDeleteSuccess'))
        return null
    }
}
