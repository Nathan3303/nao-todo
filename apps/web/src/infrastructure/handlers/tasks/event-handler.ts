import type { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { unwrapErrors } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { EventViewObject, UpdateEventViewObject, CreateEventViewObject } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/infrastructure/locales'

const useEventHandler = (eventUseCase: EventUseCase) => {
    const createEvent = async (createEvent: CreateEventViewObject) => {
        const [, err] = await eventUseCase.create(createEvent)
        if (err !== null) {
            NueMessage.error(t('task.eventCreateFailed', { error: `(${unwrapErrors(err)})` }))
            return
        }
        NueMessage.success(t('task.eventCreateSuccess'))
    }

    const updateEvent = async (
        eventId: EventViewObject['id'],
        updateEvent: UpdateEventViewObject
    ) => {
        if (!eventId) return
        const [, err] = await eventUseCase.update(eventId, updateEvent)
        if (err !== null) {
            NueMessage.error(t('task.eventUpdateFailed', { error: `(${unwrapErrors(err)})` }))
            return
        }
        NueMessage.success(t('task.eventUpdateSuccess'))
    }

    const deleteEvent = async (eventId: EventViewObject['id']) => {
        if (!eventId) return
        const [, err] = await eventUseCase.delete(eventId)
        if (err !== null) {
            NueMessage.error(t('task.eventDeleteFailed', { error: `(${unwrapErrors(err)})` }))
            return
        }
        NueMessage.success(t('task.eventDeleteSuccess'))
    }

    return {
        createEvent,
        updateEvent,
        deleteEvent
    }
}

export default useEventHandler
export type EventHandler = ReturnType<typeof useEventHandler>
