import { ref } from 'vue'
import { useEventStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import type { Event } from '@/stores'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@/components'
import type { TodoEventDetailsProps } from './types'

export const useEventDetails = (props: TodoEventDetailsProps) => {
    const eventStore = useEventStore()
    const userStore = useUserStore()

    const loadingState = ref(false)

    const init = async () => {
        loadingState.value = true
        const { todoId } = props
        await eventStore.init(userStore.user!.id, { todoId })
        loadingState.value = true
    }

    const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
        const { value: title } = payload
        const { todoId } = props
        await eventStore.create(userStore.user!.id, todoId, title)
    }

    const handleUpdateEvent = async (event: TodoEventRowUpdatePayload) => {
        const eventId = event.id
        await eventStore.update(userStore.user!.id, eventId, { ...event })
    }

    const handleDeleteEvent = async (eventId: Event['id']) => {
        await eventStore.remove(userStore.user!.id, eventId)
    }

    return {
        loadingState,
        init,
        handleCreateEvent,
        handleUpdateEvent,
        handleDeleteEvent
    }
}
