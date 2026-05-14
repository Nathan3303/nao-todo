<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { EventRowProps, EventRowEmits } from './types'
import { NueInput } from 'nue-ui'

defineOptions({ name: 'EventRow' })
const props = defineProps<EventRowProps>()
const emit = defineEmits<EventRowEmits>()

const eventNameInputer = ref<InstanceType<typeof NueInput>>()
const inputValue = ref(props.event.name)
const isEditing = ref(false)
const updateLoading = ref(false)

const handleGoEdit = () => {
    if (updateLoading.value) return
    isEditing.value = true
    nextTick(() => eventNameInputer.value?.innerInputRef?.focus())
}

const handleUpdateIsDone = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { isDone: !props.event.isDone })
        .finally(() => (updateLoading.value = false))
}

const handleUpdateName = () => {
    if (updateLoading.value) {
        isEditing.value = false
        return
    }
    if (inputValue.value === props.event.name) {
        isEditing.value = false
        return
    }
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { name: inputValue.value })
        .finally(() => (isEditing.value = updateLoading.value = false))
}

const handleDelete = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props.onDelete(props.event.id).finally(() => (updateLoading.value = false))
}
</script>

<template>
    <nue-div theme="event-row">
        <nue-icon theme="drag-icon" name="more-vertical" draggable="true" />
        <nue-icon
            theme="pointer"
            :name="updateLoading ? 'loading' : event.isDone ? 'square-check-fill' : 'square'"
            :spin="updateLoading"
            @click="handleUpdateIsDone"
        />
        <nue-text v-if="!isEditing" theme="event-row__name" @click="handleGoEdit" :clamped="1">
            {{ event.name }}
        </nue-text>
        <nue-input
            v-else
            ref="eventNameInputer"
            :key="event.id"
            theme="small,pure"
            v-model="inputValue"
            :disabled="updateLoading"
            @blur="handleUpdateName"
            maxlength="64"
            counter="word-left"
        />
        <nue-div theme="actions">
            <nue-icon
                name="plus-circle"
                title="依据该检查事项创建新任务"
                theme="pointer"
                @click="emit('toTask', event.id)"
            />
            <nue-icon
                name="delete"
                title="删除事件"
                theme="pointer"
                :color="updateLoading ? 'gray' : '#ff6f6f'"
                @click="handleDelete"
            />
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import './row.css';
</style>

