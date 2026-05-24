<script setup lang="ts">
import { inject, computed } from 'vue'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'
import type { TaskTableContext, TaskTableOrderButtonProps } from './types'

defineOptions({ name: 'TaskTableOrderButton' })
const props = defineProps<TaskTableOrderButtonProps>()

const { getOptions, updateSortOptions } = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)!

const checkNumber = computed(() => {
    const { prop } = props
    if (!getOptions.value.sort) return
    if (prop !== getOptions.value.sort?.field) return
    return getOptions.value.sort?.order === 'asc' ? 1 : -1
})

const ascIconName = computed(() => {
    const { prop } = props
    if (prop !== getOptions.value.sort?.field) return ''
    return getOptions.value.sort?.order === 'asc' ? 'check' : ''
})

const descIconName = computed(() => {
    const { prop } = props
    if (prop !== getOptions.value.sort?.field) return ''
    return getOptions.value.sort?.order === 'desc' ? 'check' : ''
})

const handleExecute = (id: string) => {
    switch (id) {
        case 'go-asc':
            updateSortOptions(props.prop, 'asc')
            break
        case 'go-desc':
            updateSortOptions(props.prop, 'desc')
            break
    }
}
</script>

<template>
    <nue-dropdown theme="combo-box,small" close-when-executed @execute="handleExecute">
        <template #trigger="{ trigger }">
            <nue-div align="center" gap="0.5rem">
                <nue-text @click="trigger" style="cursor: pointer">
                    <slot>{{ text }}</slot>
                </nue-text>
                <nue-icon
                    v-if="checkNumber"
                    :name="checkNumber === 1 ? 'arrow-up' : 'arrow-down'"
                />
            </nue-div>
        </template>
        <template #default>
            <nue-div theme="block">
                <nue-dropdown-item size="small" icon="arrow-up" text="升序" execute-id="go-asc">
                    <template #append>
                        <nue-icon :name="ascIconName" />
                    </template>
                </nue-dropdown-item>
                <nue-dropdown-item size="small" icon="arrow-down" text="降序" execute-id="go-desc">
                    <template #append>
                        <nue-icon :name="descIconName" />
                    </template>
                </nue-dropdown-item>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<style scoped></style>

