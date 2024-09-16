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
import { ref } from 'vue'
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
const loading = ref(false)

const handleInit = async () => {
    loading.value = true
    await init()
    loading.value = false
}

handleInit()
</script>
