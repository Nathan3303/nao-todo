<script setup lang="ts">
import { TodoCheckButton, TodoDateSelector } from '@nao-todo/components'
import type { DetailsHeaderEmits, DetailsHeaderProps } from './types'

defineProps<DetailsHeaderProps>()
const emit = defineEmits<DetailsHeaderEmits>()
</script>

<template>
    <nue-header v-if="shadowTodo" class="tasks-details-view__header">
        <nue-div align="center" width="auto" wrap="nowrap">
            <todo-check-button
                :is-done="shadowTodo.state === 'done'"
                @change="emit('finishTodo')"
            />
            <nue-divider direction="vertical" />
            <todo-date-selector
                v-model="shadowTodo.dueDate.endAt"
                @change="(v) => emit('updateTodoEndAt', v)"
            />
        </nue-div>
        <nue-div align="center" width="auto" wrap="nowrap">
            <nue-button :disabled="disableClose" icon="clear" theme="small" @click="emit('close')">
                关闭
            </nue-button>
        </nue-div>
    </nue-header>
</template>

<style scoped>
.tasks-details-view__header {
    height: auto;
    justify-content: space-between;
    box-sizing: border-box;
}
</style>
