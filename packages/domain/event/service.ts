import type { EventEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { EventRepository } from './repositories'

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
     * @param eventEntity 检查事项实体
     * @returns 检查事项实体
     */
    async create(eventEntity: EventEntity): GoAsync<EventEntity> {
        return this.eventRepo.create(eventEntity)
    }

    /**
     * 更新检查事项
     * @param eventId 检查事项 ID
     * @param eventEntity 检查事项实体
     * @returns 更新结果
     */
    async update(eventId: EventEntity['id'], eventEntity: EventEntity): GoAsync<string> {
        return this.eventRepo.update(eventId, eventEntity)
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
}
