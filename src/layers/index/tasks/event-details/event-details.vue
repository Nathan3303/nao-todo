<template>
    <nue-div vertical gap="4px">
        <todo-event-row
            v-for="event in events"
            :key="event.id"
            :event="event"
            @update="handleUpdateEvent"
            @delete="handleDeleteEvent"
        ></todo-event-row>
        <input-button
            icon="plus-circle"
            button-text="添加检查事项"
            theme="pure,noshape"
            :submit-on-blur="false"
            @submit="handleCreateEvent"
        ></input-button>
    </nue-div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { InputButton, TodoEventRow } from '@/components'
import { useEventStore } from '@/stores'
import { useEventDetails } from './use-event-details'
import type { TodoEventDetailsProps } from './types'

defineOptions({ name: 'TodoEventDetails' })
const props = defineProps<TodoEventDetailsProps>()

const eventStore = useEventStore()
const { init, handleCreateEvent, handleUpdateEvent, handleDeleteEvent } = useEventDetails(props)

const { events } = storeToRefs(eventStore)

await init()
</script>
