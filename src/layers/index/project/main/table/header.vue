<template>
    <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
        <nue-div align="center" justify="space-between" wrap="nowrap" gap="16px">
            <nue-div align="center" wrap="nowrap" flex="none" width="fit-content" gap="12px">
                <nue-input
                    :theme="filterValue ? 'small,actived' : 'small'"
                    v-model="filterValue"
                    placeholder="Filter tasks"
                    icon="filter"
                    clearable
                    :debounce-time="300"
                ></nue-input>
                <nue-button theme="small" icon="plus-circle" disabled>Status</nue-button>
                <nue-button theme="small" icon="plus-circle" disabled>Priority</nue-button>
                <!-- <nue-text v-if="filterValue" size="12px" color="orange" decoration="underline">
                    Your are in the filtering mode!
                </nue-text> -->
            </nue-div>
            <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                <nue-button theme="small,primary" icon="plus-circle" @click="handleAddTodo">
                    Add
                </nue-button>
                <nue-button theme="small" icon="menu" disabled>View</nue-button>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Todo, TodoFilter } from '@/stores/use-todo-store'
import { NuePrompt, NueMessage } from 'nue-ui'

const emit = defineEmits<{
    (event: 'addTodo', todoName: Todo['name']): void
    (event: 'filterTodos', payload: TodoFilter): void
}>()

const filterValue = ref('')

function handleAddTodo() {
    NuePrompt({
        title: 'Create new todo',
        placeholder: 'Please input todo name here...',
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then(
        (value) => emit('addTodo', value as Todo['name']),
        () => NueMessage.info('Operation cancelled.')
    )
}

watch(
    () => filterValue.value,
    (newValue) => {
        emit('filterTodos', { name: newValue } as TodoFilter)
    }
)
</script>

<style scoped>
.nue-input--actived {
    border-color: orange;
    box-shadow: var(--secondary-shadow);
}
</style>
