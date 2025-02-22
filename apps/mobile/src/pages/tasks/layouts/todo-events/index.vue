<script lang="ts" setup>
import { watch, ref } from 'vue'
import { useEventStore } from '@/pages/tasks/stores/event'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import EventRow from './row.vue'
import AddEventBar from './add-event-bar.vue'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TodoEvents' })

const eventStore = useEventStore()
const tasksViewStore = useTasksViewStore()

const { events } = storeToRefs(eventStore)
const { todoDetailsId } = storeToRefs(tasksViewStore)
const loading = ref(false)

const getEvents = async () => {
    if (!todoDetailsId.value) return
    loading.value = true
    eventStore.getOptions.todoId = todoDetailsId.value
    await eventStore.getEvents()
    loading.value = true
}

watch(
    () => todoDetailsId.value,
    (newId) => {
        if (!newId) return
        getEvents()
    },
    { immediate: true }
)
</script>

<template>
    <view class="todo-events">
        <view class="todo-events__list">
            <event-row v-for="event in events" :key="event.id" :event="event" />
        </view>
        <add-event-bar />
    </view>
</template>

<style scoped>
.todo-events,
.todo-events__list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
}
</style>
