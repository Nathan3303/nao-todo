<script setup lang="ts">
import { TodoCheckButton, TodoDateSelector } from '@nao-todo/components'
import type { DetailsHeaderEmits, DetailsHeaderProps } from './types'

defineProps<DetailsHeaderProps>()
const emit = defineEmits<DetailsHeaderEmits>()
</script>

<template>
    <nue-div style="padding: 1rem" width="100%" auto-fit>
        <nue-div align="center" flex="1">
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
        <nue-div>
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

