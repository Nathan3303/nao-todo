import type { GoAsync, Pagination } from '@nao-todo/shared/types'
import type { GetTasksOptions } from '@nao-todo/shared/constants/task'
import { QueryOptionsValueObject } from '@nao-todo/shared/valueobjects/query-options'
import dayjs from 'dayjs'
import { isGivenUpBy, isStarMarkedBy, TaskEntity } from '../../domain/entities'
import { TaskErrorCode } from '../../domain/errors'
import { TaskRepository } from '../../domain/repositories'
import { TaskDomain } from '../../domain/services'
import { UpdateTaskValueObject } from '../../domain/valueobjects'
import type { CreateTaskViewObject, TaskViewObject, UpdateTaskViewObject } from '../viewobjects'
import type { TaskStore } from '../stores'
import {
    createTaskViewObjectToValueObject,
    taskEntitiesToViewObjects,
    taskEntityToViewObject,
    updateTaskViewObjectToValueObject
} from './converters'

/**
 * 任务用例
 * @description 任务用例负责处理任务相关的业务逻辑，包括加载、删除、创建、更新任务等。
 */
export class TaskUseCase {
    /**
     * 任务用例
     * @param taskDomain 任务领域服务
     * @param taskRepo 任务仓库
     * @param taskStore 任务用例存储
     */
    constructor(
        private taskDomain: TaskDomain,
        private taskRepo: TaskRepository,
        private taskStore: TaskStore
    ) {}

    // --- Task ---

    /**
     * 校验父任务赋值是否合法
     * @description 产品深度限制：仅一级子任务 ⇒ 父任务必须是顶层任务（parentTaskId === ''），
     *              天然杜绝循环嵌套（只剩自指需拦截）。
     * @param targetId 被移动方任务 ID（null = 新建任务场景，跳过自指/已有子任务检查）
     * @param parentId 候选父任务 ID（'' = 解除父子关系，始终放行）
     * @returns 校验通过返回 null，否则返回领域错误码
     */
    private async assertParentAssignable(
        targetId: TaskViewObject['id'] | null,
        parentId: string
    ): GoAsync<void> {
        // 1. 解除父子关系（移动到顶层）始终放行
        if (parentId === '') return null
        // 2. 禁止自指
        if (targetId !== null && parentId === targetId) return TaskErrorCode.PARENT_SELF
        // 3. 父任务必须存在
        const [parent, getError] = await this.taskRepo.get(parentId)
        if (getError !== null || !parent) return TaskErrorCode.PARENT_NOT_FOUND
        // 4. 父任务必须是顶层任务（子任务不能作为父，深度限制的核心防线）
        if (parent.parentTaskId !== '') return TaskErrorCode.PARENT_MUST_BE_TOP_LEVEL
        // 5. 被移动方若已有子任务，移动成子任务会造出第二层，拒绝（需先处理子任务）
        if (targetId !== null) {
            const [children] = await this.taskDomain.listTasks(
                new QueryOptionsValueObject({ parentTaskId: targetId, isDeleted: false, limit: 1 })
            )
            if ((children?.taskEntities.length ?? 0) > 0) return TaskErrorCode.PARENT_HAS_SUBTASKS
        }
        return null
    }

    /**
     * 加载任务
     * @param id 任务ID
     * @returns 任务视图对象
     */
    async get(id: TaskViewObject['id']): GoAsync<TaskViewObject> {
        // 获取任务实体
        const [taskEntity, err] = await this.taskRepo.get(id)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务
        this.taskStore.addTask(taskViewObject)
        // 实体转换为视图对象
        return [taskViewObject, null]
    }

    /**
     * 加载任务列表
     * @param getTasksOptions 获取任务选项
     * @returns 任务ID列表
     */
    async list(getTasksOptions: GetTasksOptions): GoAsync<{
        taskIds: TaskViewObject['id'][]
        pagination?: Pagination
    }> {
        // 数据转换
        const queryOptionsVO = new QueryOptionsValueObject(getTasksOptions)
        // 获取任务实体列表
        const [listResult, err] = await this.taskDomain.listTasks(queryOptionsVO)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const { taskEntities, pagination } = listResult
        const taskViewObjects = taskEntitiesToViewObjects(taskEntities)
        const taskIds = taskViewObjects.map((task) => task.id)
        // 存储任务列表
        this.taskStore.addTasks(taskViewObjects)
        // 返回任务ID列表
        return [{ taskIds, pagination }, null]
    }

    /**
     * 删除任务
     * @param id 任务ID
     * @returns 错误信息
     */
    async delete(id: TaskViewObject['id']): GoAsync<void> {
        // 删除任务
        const err = await this.taskRepo.remove(id)
        if (err !== null) return err
        // 更新任务状态为已删除
        this.taskStore.updateTask(id, { deletedAt: dayjs().toISOString() })
        // 返回成功
        return null
    }

    /**
     * 恢复任务
     * @param id 任务ID
     * @returns 错误信息
     */
    async restore(id: TaskViewObject['id']): GoAsync<void> {
        // 恢复
        const err = await this.taskRepo.restore(id)
        if (err !== null) return err
        // 更新任务状态为未删除
        this.taskStore.updateTask(id, { deletedAt: null })
        // 返回成功
        return null
    }

    /**
     * 单任务「取消归档」（脱归档）
     * @description 清单仍归档 ⇒ 任务移入收集箱（`movedToInbox=true`）；清单已恢复 ⇒ 回原清单。
     *              仓储方法为**可选**（远端/mobile 不必实现）⇒ 缺失时返回「当前环境不支持」。
     *              恢复项 `sortId` 与同组活动项碰撞时以恢复值作锚归一（PA-10）。
     * @param id 任务 ID
     * @returns 是否移入收集箱
     */
    async unarchive(id: TaskViewObject['id']): GoAsync<{ movedToInbox: boolean }> {
        // 仓储可选方法守卫（远端/移动端未实现 ⇒ 明确「不支持」而非抛异常）
        if (typeof this.taskRepo.unarchive !== 'function') return [null, '当前环境不支持取消归档']
        const [result, err] = await this.taskRepo.unarchive(id)
        if (err !== null) return [null, err]
        // 同步内存数据：可见性判据只认任务自身字段（PA-9：不改清单 archivedAt）
        this.taskStore.updateTask(id, {
            archivedAt: null,
            isArchived: false,
            ...(result.movedToInbox ? { projectId: 'inbox' } : {})
        })
        // 复位归一：恢复项与同组活动项 sortId 碰撞 ⇒ 以恢复值为锚重排（两阶段 PA-10）
        const normalizeError = await this.normalizeSortAfterUnarchive(id)
        if (normalizeError !== null) return [null, normalizeError]
        return [result, null]
    }

    /** 取消归档后的 `sortId` 碰撞归一（以恢复项 sortId 为锚，语义 = 回最近位置） */
    private async normalizeSortAfterUnarchive(id: TaskViewObject['id']): GoAsync<void> {
        const restored = this.taskStore.getTask(id)
        if (!restored) return null
        const group = this.groupTasksOf(restored.parentTaskId ?? '').filter((t) => !t.isArchived)
        const members = group.some((t) => t.id === id) ? group : [...group, restored]
        const collision = members.some((t) => t.id !== id && t.sortId === restored.sortId)
        if (!collision) return null
        const sorted = [...members].sort(
            (a, b) => a.sortId - b.sortId || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        )
        const updates = sorted.map((task, index) => ({ id: task.id, sortId: (index + 1) * 1000 }))
        const [, err] = await this.batchUpdate(updates)
        return err
    }

    /**
     * 创建任务
     * @param createTaskViewObject 创建任务视图对象
     * @returns 任务视图对象
     */
    async create(createTaskViewObject: CreateTaskViewObject): GoAsync<TaskViewObject> {
        // 数据转换
        const createTaskValueObject = createTaskViewObjectToValueObject(createTaskViewObject)
        const validateErr = createTaskValueObject.validate()
        if (validateErr !== null) return [null, validateErr]
        // 父任务赋值校验（父必须存在且为顶层任务；深度限制）
        if (createTaskValueObject.parentTaskId) {
            const parentErr = await this.assertParentAssignable(
                null,
                createTaskValueObject.parentTaskId
            )
            if (parentErr !== null) return [null, parentErr]
        }
        // 创建任务
        const [taskEntity, err] = await this.taskRepo.create(createTaskValueObject)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务列表
        this.taskStore.addTask(taskViewObject)
        // 返回任务视图对象
        return [taskViewObject, null]
    }

    /**
     * 更新任务
     * @param id 任务ID
     * @param updateViewObject 更新任务视图对象
     * @returns 错误信息
     */
    async update(id: TaskViewObject['id'], updateViewObject: UpdateTaskViewObject): GoAsync<void> {
        // 获取原始数据
        // const oldTask = this.taskStore.getTask(id)
        // const newTask = { name: oldTask?.name || undefined, ...updateViewObject }
        // 数据转换
        const updateTaskValueObject = updateTaskViewObjectToValueObject(id, updateViewObject)
        const validateErr = updateTaskValueObject.validate()
        if (validateErr !== null) return validateErr
        // 星标/时间变更走实体行为方法（领域规则：已删除/已归档禁止收藏与修改时间）
        if (
            updateTaskValueObject.starMarkAt !== undefined ||
            updateTaskValueObject.startAt !== undefined ||
            updateTaskValueObject.endAt !== undefined
        ) {
            const [entity, getError] = await this.taskRepo.get(id)
            if (getError !== null) return getError
            if (!entity) return TaskErrorCode.TASK_NOT_FOUND
            // 星标变更
            if (updateTaskValueObject.starMarkAt !== undefined) {
                const starError = isStarMarkedBy(updateTaskValueObject.starMarkAt)
                    ? entity.star()
                    : entity.unstar()
                if (starError !== null) return starError
                updateTaskValueObject.starMarkAt = entity.starMarkAt
            }
            // 开始/结束时间变更
            if (
                updateTaskValueObject.startAt !== undefined ||
                updateTaskValueObject.endAt !== undefined
            ) {
                const scheduleError = entity.updateSchedule(
                    updateTaskValueObject.startAt,
                    updateTaskValueObject.endAt
                )
                if (scheduleError !== null) return scheduleError
                // 清空语义：清空后实体值为 ''（服务端契约：''=清除、null/缺省=不改），
                // 原样回写实体最终值，远程仓储据此上送 ''；undefined 仍表示本次不触碰
                if (updateTaskValueObject.startAt !== undefined)
                    updateTaskValueObject.startAt = entity.startAt
                if (updateTaskValueObject.endAt !== undefined)
                    updateTaskValueObject.endAt = entity.endAt
            }
        }
        // 父任务赋值校验（自指/父必须为顶层/被移动方不得已有子任务）
        if (updateTaskValueObject.parentTaskId !== undefined) {
            const parentErr = await this.assertParentAssignable(
                id,
                updateTaskValueObject.parentTaskId
            )
            if (parentErr !== null) return parentErr
        }
        // 更新任务
        const updateError = await this.taskRepo.update(id, updateTaskValueObject)
        if (updateError !== null) return updateError
        // 更新内存数据（根据 givenUpAt 计算 isGivenUp，根据 starMarkAt 计算 isStarMarked）
        const storeUpdateData = { ...updateViewObject }
        if (storeUpdateData.givenUpAt !== undefined) {
            storeUpdateData.isGivenUp = isGivenUpBy(storeUpdateData.givenUpAt)
        }
        if (storeUpdateData.starMarkAt !== undefined) {
            storeUpdateData.isStarMarked = isStarMarkedBy(storeUpdateData.starMarkAt)
        }
        this.taskStore.updateTask(id, storeUpdateData)
        // 返回成功
        return null
    }

    /**
     * 批量更新任务
     * @description 逐个转换与校验后交由领域服务批量更新（后端暂无批量接口，领域层 for 方式执行）；
     *              同步刷新内存数据的派生字段（isGivenUp / isStarMarked）
     * @param updates 更新任务视图对象列表（每个携带任务 ID）
     * @returns 成功更新的任务数量
     */
    async batchUpdate(
        updates: Array<UpdateTaskViewObject & { id: TaskViewObject['id'] }>
    ): GoAsync<number> {
        // 1. 逐个转换为值对象并校验
        const updateValueObjects: UpdateTaskValueObject[] = []
        for (const update of updates) {
            const valueObject = updateTaskViewObjectToValueObject(update.id, update)
            const validateErr = valueObject.validate()
            if (validateErr !== null) return [null, validateErr]
            updateValueObjects.push(valueObject)
        }
        // 2. 调用领域服务批量更新（返回成功数与失败 ID 列表）
        const [result, batchError] = await this.taskDomain.batchUpdate(updateValueObjects)
        if (batchError !== null) return [null, batchError]
        // 3. 更新内存数据（仅同步成功项，避免部分失败时 store 与后端不一致）
        const failedIdSet = new Set(result.failedIds)
        for (const update of updates) {
            if (failedIdSet.has(update.id)) continue
            const storeUpdateData = { ...update }
            if (storeUpdateData.givenUpAt !== undefined) {
                storeUpdateData.isGivenUp = isGivenUpBy(storeUpdateData.givenUpAt)
            }
            if (storeUpdateData.starMarkAt !== undefined) {
                storeUpdateData.isStarMarked = isStarMarkedBy(storeUpdateData.starMarkAt)
            }
            this.taskStore.updateTask(update.id, storeUpdateData)
        }
        // 4. 返回成功条数
        return [result.succeeded, null]
    }

    /** 组内排序最大重建行数（uint16 溢出边界：65 × 1000 = 65000 ≤ 65535） */
    private static readonly RESORT_MAX_REBUILD_SIZE = 65

    /** 取当前组（同一 parentTaskId）任务，按 sortId ASC, id ASC 排序 */
    private groupTasksOf(parentTaskId: string): TaskViewObject[] {
        return this.taskStore.tasks
            .filter((task) => (task.parentTaskId ?? '') === parentTaskId)
            .sort((a, b) => a.sortId - b.sortId || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    }

    /** 计算插入位置（移除被拖拽项后的临时数组坐标；与检查项先例同式） */
    private resolveNewIndex(originalIndex: number, boundIndex: number, isBefore: boolean): number {
        if (originalIndex < boundIndex) return isBefore ? boundIndex - 1 : boundIndex
        return isBefore ? boundIndex : boundIndex + 1
    }

    /**
     * 重新排序任务（per-group 组内重排；浮动间隔 + 本组重建）
     * @description 排序键 `sortId ASC, id ASC`；仅同组生效；重建**仅本组**（复用 `batchUpdate`）。
     *              预检「目标位置 == 当前位置」⇒ no-op（不请求/不改 store）；
     *              触发重建：相邻差 < 2、newSortId ≤ 0（前插得 0 会丢失）或 > 65535；
     *              重建条件与检查项先例有意偏离 `newSortId <= 0`（ADR Q4 注记）。
     *              组 > 65 行或未取尽（调用方传 allowRebuild=false）⇒ 禁用重建，仅单条浮动赋值。
     * @param originalId 被拖拽任务 ID
     * @param boundId 目标任务 ID
     * @param isBefore 是否插入到目标之前
     * @param options.allowRebuild 是否允许本组重建（默认 true；R1 守卫由调用方判定）
     * @returns 错误信息
     */
    async resort(
        originalId: TaskViewObject['id'],
        boundId: TaskViewObject['id'],
        isBefore: boolean,
        options: { allowRebuild?: boolean } = {}
    ): GoAsync<void> {
        const allowRebuild = options.allowRebuild ?? true
        const originalTask = this.taskStore.getTask(originalId)
        const boundTask = this.taskStore.getTask(boundId)
        if (!originalTask || !boundTask) return TaskErrorCode.TASK_NOT_FOUND
        if (originalId === boundId) return null
        // 仅同组（同一 parentTaskId）
        const parentTaskId = originalTask.parentTaskId ?? ''
        if ((boundTask.parentTaskId ?? '') !== parentTaskId) return null
        const group = this.groupTasksOf(parentTaskId)
        if (group.length <= 1) return null
        const originalIndex = group.findIndex((task) => task.id === originalId)
        const boundIndex = group.findIndex((task) => task.id === boundId)
        if (originalIndex === -1 || boundIndex === -1) return TaskErrorCode.TASK_NOT_FOUND
        const newIndex = this.resolveNewIndex(originalIndex, boundIndex, isBefore)
        // 预检：目标位置与当前位置相同 ⇒ 无变化，不发起请求、不改 store
        if (newIndex === originalIndex) return null
        // 计算相邻项与浮动 sortId（移除被拖拽项后的临时数组坐标）
        const tempTasks = [...group]
        tempTasks.splice(originalIndex, 1)
        let prevTask: TaskViewObject | null = null
        let nextTask: TaskViewObject | null = null
        if (newIndex === 0) {
            nextTask = tempTasks[0] ?? null
        } else if (newIndex === tempTasks.length) {
            prevTask = tempTasks[tempTasks.length - 1] ?? null
        } else {
            prevTask = tempTasks[newIndex - 1] ?? null
            nextTask = tempTasks[newIndex] ?? null
        }
        const INTERVAL = 1000
        let newSortId: number
        if (!prevTask) {
            newSortId = nextTask!.sortId - INTERVAL
        } else if (!nextTask) {
            newSortId = prevTask.sortId + INTERVAL
        } else {
            newSortId = Math.round((prevTask.sortId + nextTask.sortId) / 2)
        }
        const needsRebuild =
            (prevTask && nextTask && Math.abs(nextTask.sortId - prevTask.sortId) < 2) ||
            newSortId <= 0 ||
            newSortId > 65535
        if (needsRebuild) {
            if (!allowRebuild || group.length > TaskUseCase.RESORT_MAX_REBUILD_SIZE) {
                // 禁用重建：浮动值合法时单条赋值，否则 no-op（不报错）
                if (newSortId > 0 && newSortId <= 65535)
                    return await this.resortSingle(originalId, newSortId)
                return null
            }
            return await this.resortWithRebuild(originalId, boundId, isBefore)
        }
        const singleError = await this.resortSingle(originalId, newSortId)
        if (singleError === null) return null
        // 服务端溢出等明确失败：允许时本组重建后重试一次
        if (!allowRebuild || group.length > TaskUseCase.RESORT_MAX_REBUILD_SIZE) return singleError
        return await this.resortWithRebuild(originalId, boundId, isBefore)
    }

    /** 单条浮动赋值（乐观更新 + 失败回退） */
    private async resortSingle(originalId: string, newSortId: number): GoAsync<void> {
        const previousSortId = this.taskStore.getTask(originalId)?.sortId
        // 乐观更新本地，提供即时 UI 反馈
        this.taskStore.updateTask(originalId, { sortId: newSortId })
        const updateVO = new UpdateTaskValueObject(originalId)
        updateVO.sortId = newSortId
        const updateError = await this.taskRepo.update(originalId, updateVO)
        if (updateError !== null && previousSortId !== undefined) {
            // 失败回退（以服务端返回为准）
            this.taskStore.updateTask(originalId, { sortId: previousSortId })
        }
        return updateError
    }

    /** 本组重建排序：重排为 1000, 2000, …（仅本组；走 batchUpdate） */
    private async resortWithRebuild(
        originalId: string,
        boundId: string,
        isBefore: boolean
    ): GoAsync<void> {
        const originalTask = this.taskStore.getTask(originalId)
        if (!originalTask) return TaskErrorCode.TASK_NOT_FOUND
        const group = this.groupTasksOf(originalTask.parentTaskId ?? '')
        if (group.length === 0) return null
        const originalIndex = group.findIndex((task) => task.id === originalId)
        const boundIndex = group.findIndex((task) => task.id === boundId)
        if (originalIndex === -1 || boundIndex === -1) return TaskErrorCode.TASK_NOT_FOUND
        const [movedTask] = group.splice(originalIndex, 1)
        if (!movedTask) return TaskErrorCode.TASK_NOT_FOUND
        const newIndex = this.resolveNewIndex(originalIndex, boundIndex, isBefore)
        group.splice(newIndex, 0, movedTask)
        const updates = group.map((task, index) => ({ id: task.id, sortId: (index + 1) * 1000 }))
        const [, rebuildError] = await this.batchUpdate(updates)
        return rebuildError
    }

    /**
     * 复制任务
     * @param id 任务ID
     * @returns 任务视图对象
     */
    async copy(id: TaskViewObject['id']): GoAsync<TaskViewObject> {
        // 复制
        const [taskEntity, err] = await this.taskRepo.copy(id)
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const taskViewObject = taskEntityToViewObject(taskEntity)
        // 存储任务列表
        this.taskStore.addTask(taskViewObject)
        // 返回任务视图对象
        return [taskViewObject, null]
    }

    /**
     * 稍后提醒
     * @param id 任务ID
     * @param durationMinutes 延迟分钟数
     * @returns 错误信息
     */
    async snooze(id: TaskViewObject['id'], durationMinutes: number): GoAsync<void> {
        // 时长合法性由领域层裁定
        const invalidErr = TaskEntity.validateSnoozeDuration(durationMinutes)
        if (invalidErr !== null) return invalidErr
        // 执行延迟提醒
        const [newRemindAt, err] = await this.taskRepo.snooze(id, durationMinutes)
        if (err !== null) return err
        // 更新本地数据
        this.taskStore.updateTask(id, { remindAt: newRemindAt })
        // 返回
        return null
    }
}

/**
 * 创建任务用例
 * @param taskStore 任务存储实现
 * @param taskCheckItemStore 任务检查项存储实现
 * @param taskCommentStore 任务评论存储实现
 * @returns TaskUseCase 实例
 */
// export const newTaskUseCase = (taskStore: TaskStore) => {
//     const requester = getRequesterImpl()
//     const taskRepo = newTaskRepository(requester)
//     const taskCheckItemRepo = newTaskCheckItemRepository(requester)
//     const taskCommentRepo = newTaskCommentRepository(requester)
//     const taskDomain = new TaskDomain(taskRepo, taskCheckItemRepo, taskCommentRepo)
//     return new TaskUseCase(taskDomain, taskRepo, taskStore)
// }