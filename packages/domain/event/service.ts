import { EventEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { EventRepository, BatchUpdateEventResult } from './repositories'
import { CreateEventValueObject, UpdateEventValueObject } from './valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'

export class EventDomain {
    /**
     * 检查事项服务
     * @param eventRepo 检查事项存储库
     */
    constructor(private eventRepo: EventRepository) {}

    /**
     * 获取检查事项
     * @param eventId 检查事项 ID
     * @returns 检查事项实体
     */
    async get(eventId: EventEntity['id']): GoAsync<EventEntity> {
        return this.eventRepo.get(eventId)
    }

    /**
     * 创建检查事项
     * @param createEventValueObject 创建检查事项值对象
     * @returns 检查事项实体
     */
    async create(createEventValueObject: CreateEventValueObject): GoAsync<EventEntity> {
        // 数据校验
        const validateErr = createEventValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 创建检查事项
        return this.eventRepo.create(createEventValueObject)
    }

    /**
     * 更新检查事项
     * @param eventId 检查事项 ID
     * @param updateEventValueObject 更新检查事项值对象
     * @returns 更新结果
     */
    async update(
        eventId: EventEntity['id'],
        updateEventValueObject: UpdateEventValueObject
    ): GoAsync<string> {
        // 数据校验
        const validateErr = updateEventValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 更新检查事项
        return this.eventRepo.update(eventId, updateEventValueObject)
    }

    /**
     * 删除检查事项
     * @param eventId 检查事项 ID
     * @returns 删除结果
     */
    async remove(eventId: EventEntity['id']): GoAsync<void> {
        return this.eventRepo.remove(eventId)
    }

    /**
     * 获取检查事项列表
     * @param taskId 任务 ID
     * @returns 检查事项实体列表
     */
    async list(taskId: EventEntity['taskId']): GoAsync<EventEntity[]> {
        return this.eventRepo.list(taskId)
    }

    /**
     * 批量更新检查事项
     * @param events 检查事项实体列表
     * @returns 批量更新结果
     */
    async batchUpdate(events: EventEntity[]): GoAsync<BatchUpdateEventResult> {
        return this.eventRepo.batchUpdate(events)
    }
}
