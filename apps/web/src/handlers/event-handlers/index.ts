import { useEventStore, useUserStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Event, EventFilterOptions } from '@/stores'

const userStore = useUserStore()
const eventStore = useEventStore()

// Standards

export const getEvents = async (filterOptions: EventFilterOptions) => {
    const userId = userStore.user!.id
await eventStore.initialize(userId, filterOptions)
}

export const createEvent = async (todoId: Event['todoId'], eventTitle: Event['title']) => {
    const userId = userStore.user!.id
    const res = await eventStore.create(userId, { todoId, title: eventTitle })
    if (res) {
        NueMessage.success('创建成功')
    } else {
        NueMessage.error('创建失败')
    }
    return res
}

export const updateEvent = async (eventId: Event['id'], updateInfo: Partial<Event>) => {
    const userId = userStore.user!.id
    const res = await eventStore.update(userId, eventId, updateInfo)
    if (res) {
        NueMessage.success('更新成功')
    } else {
        NueMessage.error('更新失败')
    }
    return res
}

export const removeEvent = async (eventId: Event['id']) => {
    const userId = userStore.user!.id
    const res = await eventStore.remove(userId, eventId)
    if (res) {
        NueMessage.success('删除成功')
    } else {
        NueMessage.error('删除失败')
    }
    return res
}

// Extends

export const finishEvent = async (eventId: Event['id']) => {
    await updateEvent(eventId, { isDone: true })
}

export const unfinishEvent = async (eventId: Event['id']) => {
    await updateEvent(eventId, { isDone: false })
}
