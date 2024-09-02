import { ref } from 'vue'
import { getEvents, createEvent, updateEvent, removeEvent } from '@/utils'
import type { Event } from '@/stores'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@/components'
import type { TodoEventDetailsProps } from './types'

export const useEventDetails = (props: TodoEventDetailsProps) => {
    const loadingState = ref(false)

    const init = async () => {
        loadingState.value = true
        await getEvents({ todoId: props.todoId })
        loadingState.value = true
    }

    const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
        await createEvent(props.todoId, payload.value)
    }

    const handleUpdateEvent = async (event: TodoEventRowUpdatePayload) => {
        console.log('[useEventDetails] handleUpdateEvent:', event)
        await updateEvent(event.id, { ...event })
    }

    const handleDeleteEvent = async (eventId: Event['id']) => {
        await removeEvent(eventId)
    }

    return {
        loadingState,
        init,
        handleCreateEvent,
        handleUpdateEvent,
        handleDeleteEvent
    }
}
