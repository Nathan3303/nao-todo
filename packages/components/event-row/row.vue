<script setup lang="ts">
import { ref } from 'vue'
import type { EventRowProps } from './types'

defineOptions({ name: 'EventRow' })
const props = defineProps<EventRowProps>()

const inputValue = ref(props.event.name)
const updateLoading = ref(false)

const handleUpdateIsDone = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { isDone: !props.event.isDone })
        .finally(() => (updateLoading.value = false))
}

const handleUpdateName = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { name: inputValue.value })
        .finally(() => (updateLoading.value = false))
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
            size="1rem"
            @click="handleUpdateIsDone"
        />
        <nue-input
            :key="event.id"
            theme="small,pure"
            v-model="inputValue"
            :data-is-done="event.isDone"
            :disabled="updateLoading"
            @blur="handleUpdateName"
        />
        <nue-div theme="actions">
            <nue-icon
                name="delete"
                theme="pointer"
                :color="updateLoading ? 'gray' : '#ff6f6f'"
                @click="handleDelete"
            />
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--event-row {
    display: flex;
    width: calc(100% + 2rem);
    height: var(--nue-box-size-sm);
    gap: 0.5rem;
    padding: 0 1rem;
    margin-left: -1rem;
    align-items: center;
    position: relative;
    transition:
        background-color 0.2s ease,
        transform 0.2s ease,
        opacity 0.2s ease;

    .nue-icon--pointer {
        cursor: pointer;
        flex-shrink: 0;
    }

    > .nue-icon--drag-icon {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
        cursor: grabbing;
        position: absolute;
        left: 0;
        opacity: 0;
        font-weight: bold;
        transition: opacity 0.2s ease;
        z-index: 1;

        &:hover {
            opacity: 1;
        }
    }

    > .nue-input--small {
        --nue-input-disabled-background-color: transparent;
        --nue-input-color: var(--nue-primary-color-900);
        --nue-input-font-size: var(--nue-text-sm);
        flex: 1;
        border: none;

        &[data-is-done='true'] {
            color: var(--nue-primary-color-600);
            --nue-input-color: var(--nue-primary-color-600);

            &:deep(.nue-input__input) {
                text-decoration: line-through;
            }
        }
    }

    > .nue-div--actions {
        visibility: hidden;
        gap: 0.25rem;
        align-items: center;
        transition: visibility 0.2s ease;
        flex-shrink: 0;

        @media (max-width: 445px) {
            display: block;
        }
    }

    &:hover,
    &:focus-within {
        background-color: var(--nue-primary-color-100);

        > .nue-div--actions {
            visibility: visible;
        }

        > .nue-icon--drag-icon {
            opacity: 1;
        }
    }

    &[data-dragging='true'] {
        opacity: 0.5;
        transform: scale(0.98);
    }
}
</style>

