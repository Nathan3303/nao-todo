<template>
    <nue-div vertical gap="4px">
        <nue-div v-if="loading" align="center" gap="8px" style="height: 28px">
            <nue-icon size="13px" name="loading" spin />
            <nue-text size="12px" color="gray">检查事项加载中 ...</nue-text>
        </nue-div>
        <template v-else>
            <todo-event-row
                v-for="event in events"
                :key="event.id"
                :event="event"
                :on-update="handleUpdateEvent"
                :on-delete="handleDeleteEvent"
            />
            <input-button
                icon="plus-circle"
                button-text="添加检查事项"
                theme="pure,noshape"
                :submit-on-blur="false"
                :on-submit="handleCreateEvent"
            />
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { InputButton, TodoEventRow } from '@nao-todo/components'
import { useEventStore } from '@/stores'
import type { DetailsMainEventsProps } from './types'
import type { CreateEventOptions, Event, UpdateEventOptions } from '@nao-todo/types'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@nao-todo/components'

const props = defineProps<DetailsMainEventsProps>()

const eventStore = useEventStore()

const { events } = storeToRefs(eventStore)

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
</script>
