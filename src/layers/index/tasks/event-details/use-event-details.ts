import { ref } from 'vue'
import { useEventStore, useUserStore, useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import type { Event } from '@/stores'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@/components'

export const useEventDetails = () => {
    const eventStore = useEventStore()
    const userStore = useUserStore()
    const todoStore = useTodoStore()

    const loadingState = ref(false)

    const init = async () => {
        loadingState.value = true
        await eventStore.init(userStore.user!.id, { todoId: todoStore.todo!.id })
        loadingState.value = true
    }

    const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
        const { value: title } = payload
        await eventStore.create(userStore.user!.id, todoStore.todo!.id, title)
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
