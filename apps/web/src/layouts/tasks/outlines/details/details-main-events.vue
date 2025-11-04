<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { InputButton, TodoEventRow } from '@nao-todo/components'
import { useTodoDetailsStore } from '@/stores/tasks'
import type { DetailsMainEventsProps } from './types'

defineProps<DetailsMainEventsProps>()

const todoDetailsStore = useTodoDetailsStore()

const { events } = storeToRefs(todoDetailsStore)
</script>

<template>
    <nue-div vertical gap="0.25rem">
        <todo-event-row
            v-for="event in events"
            :key="event.id"
            :event="event"
            :on-update="todoDetailsStore.handleUpdateEvent"
            :on-delete="todoDetailsStore.handleDeleteEvent"
        />
        <input-button
            icon="plus-circle"
            button-text="添加检查事项"
            theme="pure,noshape"
            :submit-on-blur="false"
            :on-submit="todoDetailsStore.handleCreateEvent"
        />
    </nue-div>
</template>
