<script setup lang="ts">
import { InputButton, EventRow } from '@nao-todo/components'
import useEventDragger from '../use-event-dragger'
import type { TaskDetailsContext } from '../types'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import { inject } from 'vue'

const { vo, events, resortEvents, eventHandler } =
    inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!

const { handleDragStart, handleDragOver, handleDrop, handleDragLeave, handleDragEnd } =
    useEventDragger((dragged, dropped, isUp) => {
        if (!dragged.dataset.eid || !dropped.dataset.eid) return
        resortEvents(dragged.dataset.eid, dropped.dataset.eid, isUp)
    })

const createEvent = async (payload: { value: string }) => {
    if (!vo.value) return
    await eventHandler.createEvent({ taskId: vo.value.id, name: payload.value })
}
</script>

<template>
    <nue-div theme="event-list" vertical gap="0.2rem" auto-fit>
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
                v-for="event in events"
                data-drag-item="true"
                :key="event.id"
                :event="event"
                :data-eid="event.id"
                :on-update="(v) => eventHandler.updateEvent(v.id, v)"
                :on-delete="eventHandler.deleteEvent"
            />
        </nue-div>
        <input-button
            icon="plus-circle"
            button-text="添加检查事项"
            theme="pure,noshape"
            :submit-on-blur="false"
            :on-submit="createEvent"
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

