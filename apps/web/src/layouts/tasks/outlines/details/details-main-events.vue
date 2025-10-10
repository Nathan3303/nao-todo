<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { InputButton, TodoEventRow } from '@nao-todo/components'
import { useTasksDataStore } from '@/stores/tasks'
import { watch } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import type { Event } from '@nao-todo/types'
import type { DetailsMainEventsProps } from './types'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@nao-todo/components'

const props = defineProps<DetailsMainEventsProps>()

const tasksDataStore = useTasksDataStore()

const { events } = storeToRefs(tasksDataStore)
const loading = ref(true)
const error = ref('')

const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
    return await tasksDataStore.createEvent({
        todoId: props.todoId,
        name: payload.value as string
    })
}

const handleUpdateEvent = async (payload: TodoEventRowUpdatePayload) => {
    return await tasksDataStore.updateEvent(payload.id, {
        name: payload.name,
        isDone: payload.isDone
    })
}

const handleDeleteEvent = async (eventId: Event['id']) => {
    return await tasksDataStore.deleteEvent(eventId)
}

watch(
    () => props.todoId,
    async (newTodoId) => {
        // 重置加载状态
        loading.value = true
        // 获取检查事项
        const err = await tasksDataStore.getEvents({ todoId: newTodoId })
        loading.value = false
        // 处理失败结果
        if (err) {
            error.value = unwrapError(err)
            return
        }
        error.value = ''
    },
    { immediate: true }
)
</script>

<template>
    <nue-div vertical gap="4px" flex="1">
        <nue-div v-if="loading" align="center" gap="8px" style="height: 28px">
            <nue-icon size="var(--nue-text-sm)" name="loading" spin />
            <nue-text size="var(--nue-text-sm)" color="gray">检查事项加载中 ...</nue-text>
        </nue-div>
        <nue-div v-else-if="error">加载失败</nue-div>
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
