import type { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { unwrapErrors } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { EventViewObject, UpdateEventViewObject, CreateEventViewObject } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'

const useEventHandler = (eventUseCase: EventUseCase) => {
    // @method 创建 event
    const createEvent = async (createEvent: CreateEventViewObject) => {
        const [, err] = await eventUseCase.create(createEvent)
        if (err !== null) {
            NueMessage.error('检查事项创建失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('检查事项创建成功')
    }

    // @method 更新 event
    const updateEvent = async (
        eventId: EventViewObject['id'],
        updateEvent: UpdateEventViewObject
    ) => {
        if (!eventId) return
        const [, err] = await eventUseCase.update(eventId, updateEvent)
        if (err !== null) {
            NueMessage.error('检查事项更新失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('检查事项更新成功')
    }

    // @method 删除 event
    const deleteEvent = async (eventId: EventViewObject['id']) => {
        if (!eventId) return
        const [, err] = await eventUseCase.delete(eventId)
        if (err !== null) {
            NueMessage.error('检查事项删除失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('检查事项删除成功')
    }

    // @method 重新排序 event

    // @return
    return {
        createEvent,
        updateEvent,
        deleteEvent
    }
}

export default useEventHandler
export type EventHandler = ReturnType<typeof useEventHandler>
