import type { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { unwrapErrors } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { Event, UpdateEvent, CreateEvent } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'

const useEventHandler = (eventUseCase: EventUseCase) => {
    // @method 创建 event
    const createEvent = async (createEvent: CreateEvent) => {
        const [, err] = await eventUseCase.create(createEvent)
        if (err !== null) {
            NueMessage.error('检查事项创建失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('检查事项创建成功')
    }

    // @method 更新 event
    const updateEvent = async (eventId: Event['id'], updateEvent: UpdateEvent) => {
        if (!eventId) return
        const [, err] = await eventUseCase.update(eventId, updateEvent)
        if (err !== null) {
            NueMessage.error('检查事项更新失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('检查事项更新成功')
    }

    // @method 删除 event
    const deleteEvent = async (eventId: Event['id']) => {
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
