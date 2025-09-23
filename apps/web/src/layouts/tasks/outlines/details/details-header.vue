<script setup lang="ts">
import { TodoCheckButton, TodoDateSelector } from '@nao-todo/components'
import type { DetailsHeaderEmits, DetailsHeaderProps } from './types'

defineOptions({ name: 'TasksTodoDetailsHeader' })
defineProps<DetailsHeaderProps>()
const emit = defineEmits<DetailsHeaderEmits>()
</script>

<template>
    <nue-div wrap="nowrap" justify="space-between" style="padding: 1rem">
        <nue-div align="center" width="auto" wrap="nowrap">
            <todo-check-button
                :is-done="shadowTodo!.state === 'done'"
                @change="emit('finishTodo')"
            />
            <nue-divider vertical />
            <todo-date-selector
                v-model="shadowTodo!.endAt"
                @change="(v) => emit('updateTodoEndAt', v)"
            />
        </nue-div>
        <nue-div align="center" width="auto" wrap="nowrap">
            <nue-icon
                v-show="updating"
                name="loading"
                spin
                size="var(--nue-text-sm)"
                color="orange"
            />
            <nue-button
                :disabled="disableClose"
                icon="clear"
                theme="small,icon"
                @click="emit('close')"
            />
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-button--update {
    --nue-button-color: orange;
}
</style>
