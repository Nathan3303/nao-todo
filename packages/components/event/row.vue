<script setup lang="ts">
import { ref } from 'vue'

type EventInfo = {
    id: string
    name: string
    isDone: boolean
}
type EventRowUpdatePayload = EventInfo
type EventRowProps = {
    event: EventInfo
    onUpdate: (payload: EventRowUpdatePayload) => Promise<any>
    onDelete: (id: string) => Promise<any>
}
type EventRowEmits = {
    (event: 'update', payload: EventRowUpdatePayload): void
    (event: 'delete', id: string): void
}

defineOptions({ name: 'EventRow' })
const props = defineProps<EventRowProps>()
const emit = defineEmits<EventRowEmits>()

const inputValue = ref(props.event.name)
const updateLoading = ref(false)

const handleUpdate = async (updateIsDone = false) => {
    const { id, name, isDone } = props.event
    if (name === inputValue.value && !updateIsDone) return
    if (updateLoading.value) return
    const _n_isDone = updateIsDone ? !isDone : isDone
    const payload = { id, name: inputValue.value, isDone: _n_isDone }
    const { onUpdate } = props
    if (onUpdate) {
        updateLoading.value = true
        await onUpdate(payload)
        updateLoading.value = false
    } else {
        emit('update', payload)
    }
}

const handleDelete = async () => {
    const { id } = props.event
    if (updateLoading.value) return
    const { onDelete } = props
    if (onDelete) {
        updateLoading.value = true
        await onDelete(id)
        updateLoading.value = false
    } else {
        emit('delete', id)
    }
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
            @click="handleUpdate(true)"
        />
        <nue-input
            :key="event.id"
            theme="small,pure"
            v-model="inputValue"
            :data-is-done="event.isDone"
            :disabled="updateLoading"
            @blur="handleUpdate(false)"
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
    gap: 0.5rem;
    padding: 0 1rem;
    margin-left: -1rem;
    align-items: center;
    position: relative;

    .nue-icon--pointer {
        cursor: pointer;
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

        &:hover {
            opacity: 1;
        }
    }

    > .nue-input--small {
        --nue-input-disabled-background-color: transparent;
        --nue-input-color: var(--nue-primary-color-800);
        --nue-input-font-size: var(--nue-text-xs);
        flex: 1;

        &[data-is-done='true'] {
            text-decoration: line-through;
            color: var(--nue-primary-color-500);
            --nue-input-color: var(--nue-primary-color-500);
        }
    }

    > .nue-div--actions {
        visibility: hidden;
        gap: 0.25rem;
        align-items: center;

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
}
</style>

