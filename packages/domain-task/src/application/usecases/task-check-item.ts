// import {
// newTaskCheckItemRepository,
//     TaskCheckItemRepoImpl
// } from '@nao-todo/infrastructure/backend/task'
import type { GoAsync } from '@nao-todo/shared'
import { TaskCheckItemRepository } from '../../domain/repositories'
import type {
    CreateTaskCheckItemViewObject,
    TaskCheckItemViewObject,
    TaskViewObject,
    UpdateTaskCheckItemViewObject
} from '../viewobjects'
import type { TaskCheckItemStore } from '../stores'
import {
    createTaskCheckItemViewObjectToValueObject,
    taskCheckItemEntityToViewObject,
    updateTaskCheckItemViewObjectToValueObject
} from './converters'
// import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

/**
 * 任务检查项使用案例
 */
export class TaskCheckItemUseCase {
    /**
     * 任务检查项使用案例
     * @param repo 任务检查项仓库
     * @param store 任务检查项存储
     */
    constructor(
        private repo: TaskCheckItemRepository,
        private store: TaskCheckItemStore
    ) {}

    /**
     * 加载任务的检查事项列表
     * @param taskId 任务ID
     * @returns 检查事项ID列表
     */
    async list(taskId: TaskViewObject['id']): GoAsync<TaskCheckItemViewObject['id'][]> {
        // 获取任务检查事项实体列表
        const [checkItemEntities, err] = await this.repo.list(taskId)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const checkItems = checkItemEntities.map(taskCheckItemEntityToViewObject)
        // 提取检查事项ID列表
        const checkItemIds = checkItems.map((item) => item.id)
        // 存储检查事项列表
        this.store.setCheckItems(checkItems)
        // 存储检查事项ID列表
        this.store.setCheckItemIds(checkItemIds)
        // 返回检查事项ID列表
        return [checkItemIds, null]
    }

    /**
     * 创建任务检查事项
     * @param createTaskCheckItemViewObject 创建任务检查事项视图对象
     * @returns 任务检查事项ID
     */
    async create(
        createViewObject: CreateTaskCheckItemViewObject
    ): GoAsync<TaskCheckItemViewObject['id']> {
        // 转换为值对象
        const createTaskCheckItemValueObject =
            createTaskCheckItemViewObjectToValueObject(createViewObject)
        // 创建检查事项
        const [createdEntity, err] = await this.repo.create(createTaskCheckItemValueObject)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const newCheckItem = taskCheckItemEntityToViewObject(createdEntity)
        // 添加到存储列表
        this.store.addCheckItem(newCheckItem)
        // 添加到检查事项ID列表
        this.store.addCheckItemId(newCheckItem.id)
        // 返回检查事项ID
        return [newCheckItem.id, null]
    }

    /**
     * 更新任务检查事项
     * @param id 任务检查事项ID
     * @param updateTaskCheckItemViewObject 更新任务检查事项视图对象
     * @returns 错误信息
     */
    async update(
        id: TaskCheckItemViewObject['id'],
        updateViewObject: UpdateTaskCheckItemViewObject
    ): GoAsync<void> {
        // 转换为值对象
        const updateValueObject = updateTaskCheckItemViewObjectToValueObject(id, updateViewObject)
        // 更新检查事项
        const updateError = await this.repo.update(id, updateValueObject)
        if (updateError !== null) return updateError
        // 更新本地数据
        this.store.updateCheckItem(id, updateViewObject)
        // 返回检查事项ID
        return null
    }

    /**
     * 删除任务检查事项
     * @param id 任务检查事项ID
     * @returns 删除后的检查事项ID
     */
    async delete(id: TaskCheckItemViewObject['id']): GoAsync<TaskCheckItemViewObject['id']> {
        // 删除检查事项
        const err = await this.repo.delete(id)
        if (err !== null) return [null, err]
        // 删除本地数据
        this.store.deleteCheckItem(id)
        return [id, null]
    }

    /**
     * 重新排序任务检查事项 - 使用浮动间隔排序法
     * @param originalId 被拖拽检查事项ID
     * @param boundId 目标检查事项ID
     * @param isBefore 是否插入到目标之前
     * @returns 排序结果
     */
    async resort(
        originalId: TaskCheckItemViewObject['id'],
        boundId: TaskCheckItemViewObject['id'],
        isBefore: boolean
    ): GoAsync<void> {
        // 获取被拖拽和目标事件
        const originalEvent = this.store.getCheckItem(originalId)
        const boundEvent = this.store.getCheckItem(boundId)
        if (!originalEvent || !boundEvent) return '事件不存在'
        // 如果拖拽到自己，不执行任何操作
        if (originalId === boundId) return null
        // 获取所有事件
        const allEvents = this.store.checkItems
        if (!allEvents) return null
        // 处理 ref 类型的 events
        const eventsValue = 'value' in allEvents ? (allEvents as any).value : allEvents
        if (!eventsValue || eventsValue.length <= 1) return null
        // 按当前 sortId 排序
        const sortedEvents = [...eventsValue].sort((a, b) => a.sortId - b.sortId)
        // 找到被拖拽和目标事件的索引
        const originalIndex = sortedEvents.findIndex((e) => e.id === originalId)
        const boundIndex = sortedEvents.findIndex((e) => e.id === boundId)
        if (originalIndex === -1 || boundIndex === -1) return '事件不存在'
        // 创建临时数组用于计算相邻元素
        const tempEvents = [...sortedEvents]
        tempEvents.splice(originalIndex, 1)
        // 计算新位置
        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }
        // 确定相邻的两个事件
        let prevEvent: TaskCheckItemViewObject | null = null
        let nextEvent: TaskCheckItemViewObject | null = null
        if (newIndex === 0) {
            nextEvent = tempEvents[0]
        } else if (newIndex === tempEvents.length) {
            prevEvent = tempEvents[tempEvents.length - 1]
        } else {
            prevEvent = tempEvents[newIndex - 1]
            nextEvent = tempEvents[newIndex]
        }
        // 计算新的 sortId - 使用浮动间隔
        let newSortId: number
        const INTERVAL = 1000
        if (!prevEvent) {
            // 插入到最前面
            newSortId = nextEvent!.sortId - INTERVAL
        } else if (!nextEvent) {
            // 插入到最后面
            newSortId = prevEvent.sortId + INTERVAL
        } else {
            // 插入到中间，取平均值并转换为整数
            newSortId = Math.round((prevEvent.sortId + nextEvent.sortId) / 2)
        }
        // 检查是否需要重建：
        // 1. 间隔太小
        // 2. sortId 可能为负数（后端要求 uint16，不能小于 0）
        const needsRebuild =
            (prevEvent && nextEvent && Math.abs(nextEvent.sortId - prevEvent.sortId) < 2) ||
            newSortId < 0
        if (needsRebuild) {
            // 间隔太小，触发重建排序
            return this.resortWithRebuild(originalId, boundId, isBefore)
        } else {
            // 只更新单个事件 - 99% 的情况走这个分支
            return this.resortSingle(originalId, newSortId)
        }
    }

    /**
     * 单事件更新 - 99% 的情况使用此方法
     * @param originalId 被拖拽事件ID
     * @param newSortId 新的 sortId
     * @returns 排序结果
     */
    async resortSingle(originalId: string, newSortId: number): GoAsync<void> {
        // 构建更新视图对象
        const updateVO = { id: originalId, sortId: newSortId } as UpdateTaskCheckItemViewObject
        // 乐观更新本地，提供即时 UI 反馈
        this.store.updateCheckItem(originalId, updateVO)
        // 更新后端
        const updateError = await this.update(originalId, updateVO)
        return updateError !== null ? updateError : null
    }

    /**
     * 重建排序 - 间隔太小时触发
     * @param originalId 被拖拽事件ID
     * @param boundId 目标事件ID
     * @param isBefore 是否插入到目标之前
     * @returns 排序结果
     */
    async resortWithRebuild(originalId: string, boundId: string, isBefore: boolean): GoAsync<void> {
        // 获取所有事件
        const allEvents = this.store.checkItems
        if (!allEvents) return null
        const eventsValue = 'value' in allEvents ? (allEvents as any).value : allEvents
        if (!eventsValue) return null
        // 按当前 sortId 排序
        const sortedEvents = [...eventsValue].sort((a, b) => a.sortId - b.sortId)
        // 找到被拖拽和目标事件的索引
        const originalIndex = sortedEvents.findIndex((e) => e.id === originalId)
        const boundIndex = sortedEvents.findIndex((e) => e.id === boundId)
        if (originalIndex === -1 || boundIndex === -1) return '事件不存在'
        // 从原位置移除被拖拽事件
        const [movedEvent] = sortedEvents.splice(originalIndex, 1)
        // 计算新位置
        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }
        // 插入到新位置
        sortedEvents.splice(newIndex, 0, movedEvent)
        // 重新分配大间隔的 sortId (1000, 2000, 3000...)
        const INTERVAL = 1000
        const eventsToUpdate = sortedEvents.map((event, index) => ({
            ...event,
            sortId: (index + 1) * INTERVAL
        }))
        // 乐观更新本地
        this.store.updateCheckItems(eventsToUpdate)
        // 构建 EventEntity 数组用于批量更新
        const eventEntities = eventsToUpdate.map((event) => {
            return {
                id: event.id,
                taskId: event.taskId,
                name: event.name,
                isDone: event.isDone,
                sortId: event.sortId
            }
        })
        // 调用后端批量更新
        const [batchResult, err] = await this.repo.batchUpdate(eventEntities as any)
        if (err !== null) return err
        // 使用后端返回的最新数据同步本地
        const updatedEvents = batchResult.map(taskCheckItemEntityToViewObject)
        this.store.updateCheckItems(updatedEvents)
        return null
    }
}

/**
 * 创建任务检查项用例
 * @param store 任务检查项存储
 * @returns 任务检查项用例
 */
// export const newTaskCheckItemUseCase = (store: TaskCheckItemStore): TaskCheckItemUseCase => {
//     const requester = getRequesterImpl()
//     const repo = newTaskCheckItemRepository(requester)
//     return new TaskCheckItemUseCase(repo, store)
// }
