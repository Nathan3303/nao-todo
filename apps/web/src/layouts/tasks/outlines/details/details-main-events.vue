<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTodoDetailsStore } from '@/stores/tasks'
import { InputButton, EventRow } from '@nao-todo/components'
import useEventDragger from './use-event-dragger'
import type { DetailsMainEventsProps } from './types'

defineProps<DetailsMainEventsProps>()

const todoDetailsStore = useTodoDetailsStore()
const { handleDragStart, handleDragOver, handleDrop, handleDragLeave, handleDragEnd } =
    useEventDragger((dragged, dropped, isUp) => {
        todoDetailsStore.handleResortEvents(
            Number(dragged.dataset.index),
            Number(dropped.dataset.index),
            isUp
        )
    })

const { events } = storeToRefs(todoDetailsStore)
</script>

<template>
    <nue-div theme="event-list" vertical gap="0.25rem" auto-fit>
        <nue-div
            vertical
            gap="0"
            theme="event-list"
            @dragover="handleDragOver"
            @dragstart="handleDragStart"
            @dragleave="handleDragLeave"
            @dragend="handleDragEnd"
            @drop="handleDrop"
        >
            <event-row
                v-for="(event, index) in events"
                data-drag-item="true"
                :key="event.id"
                :event="event"
                :data-index="index"
                :on-update="todoDetailsStore.handleUpdateEvent"
                :on-delete="todoDetailsStore.handleDeleteEvent"
            />
        </nue-div>
        <input-button
            icon="plus-circle"
            button-text="添加检查事项"
            theme="pure,noshape"
            :submit-on-blur="false"
            :on-submit="todoDetailsStore.handleCreateEvent"
        />
    </nue-div>
</template>

<style scoped>
.nue-div--event-row {
    position: relative;
    overflow: visible;

    &::before {
        content: '';
        position: absolute;
        left: 1rem;
        width: calc(100% - 1rem);
        height: 2px;
        background-color: orange;
        visibility: hidden;
        z-index: 2;
    }

    &[data-dod='up']::before {
        visibility: visible;
        top: -1px;
    }

    &[data-dod='down']::before {
        visibility: visible;
        bottom: -1px;
    }
}
</style>

