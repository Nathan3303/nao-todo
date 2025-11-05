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
    <nue-div theme="event-row" auto-fit>
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
.nue-div.nue-div--event-row {
    width: 100%;
    gap: 0.5rem;
    align-items: center;

    .nue-icon--pointer {
        cursor: pointer;
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

        @media (max-width: 445px) {
            display: block;
        }
    }

    &:hover,
    &:focus-within {
        box-shadow: 0 1px rgba(0, 0, 0, 0.3);

        > .nue-div--actions {
            visibility: visible;
        }
    }
}
</style>

