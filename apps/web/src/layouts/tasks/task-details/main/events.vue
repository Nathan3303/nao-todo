<script setup lang="ts">
import { InputButton, EventRow, Loading } from '@nao-todo/components'
import useEventDragger from '../use-event-dragger'
import type { TaskDetailsContext } from '../types'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import { inject } from 'vue'

const { vo, events, resortEvents, eventHandler, eventsLoading, eventsError, retryEvents } =
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
        <loading v-if="eventsLoading" placeholder="正在加载检查事项..." />
        <nue-empty v-else-if="eventsError" :description="eventsError" image-size="64px">
            <nue-button theme="primary,small" @click="retryEvents">重试</nue-button>
        </nue-empty>
        <template v-else>
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
                    :on-update="(id, v) => eventHandler.updateEvent(id, v)"
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
        </template>
    </nue-div>
</template>

<style scoped>
.nue-div--event-row {
    position: relative;
    overflow: visible;

    &::before {
        content: '';
        position: absolute;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, var(--nue-primary-color-500), var(--nue-primary-color-300));
        visibility: hidden;
        z-index: 10;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(var(--nue-primary-color-rgb), 0.4);
        transition: opacity 0.15s ease;
    }

    &[data-dod='up']::before {
        visibility: visible;
        top: -2px;
        animation: pulse-up 0.3s ease;
    }

    &[data-dod='down']::before {
        visibility: visible;
        bottom: -2px;
        animation: pulse-down 0.3s ease;
    }
}

@keyframes pulse-up {
    0% {
        transform: scaleX(0.5);
        opacity: 0;
    }
    100% {
        transform: scaleX(1);
        opacity: 1;
    }
}

@keyframes pulse-down {
    0% {
        transform: scaleX(0.5);
        opacity: 0;
    }
    100% {
        transform: scaleX(1);
        opacity: 1;
    }
}
</style>

