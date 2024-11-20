import { ref } from 'vue'
import { useEventStore } from '@/stores'
import type { CreateEventOptions, Event, UpdateEventOptions } from '@nao-todo/types'
import type { TodoEventDetailsProps } from './types'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@nao-todo/components'

export const useEventDetails = (props: TodoEventDetailsProps) => {
    const loadingState = ref(false)
    const eventStore = useEventStore()

    const init = async () => {
        loadingState.value = true
        eventStore.getOptions.todoId = props.todoId
        await eventStore.doGetEvents()
        loadingState.value = true
    }

    const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
        const options: CreateEventOptions = {
            todoId: props.todoId,
            title: payload.value as string
        }
        return await eventStore.doCreateEvent(options)
    }

    const handleUpdateEvent = async (payload: TodoEventRowUpdatePayload) => {
        const options: UpdateEventOptions = {
            title: payload.title,
            isDone: payload.isDone
        }
        await eventStore.doUpdateEvent(payload.id, options)
    }

    const handleDeleteEvent = async (eventId: Event['id']) => {
        return await eventStore.doDeleteEvent(eventId)
    }

    return {
        loadingState,
        init,
        handleCreateEvent,
        handleUpdateEvent,
        handleDeleteEvent
    }
}
