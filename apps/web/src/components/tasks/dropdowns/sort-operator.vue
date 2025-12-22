<script setup lang="ts">
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import type { GetTasksOptions, GetTasksSortOptions, ProjectPreferenceVO } from '@nao-todo/types'
import type { InnerDropdownOptionVO } from '@/components/ui/inner-dropdown/types'
import { columnLabels } from '@/infrastructure/constants/task'

defineOptions({ name: 'TasksDropdownSortOperator' })
const props = defineProps<{
    modelValue: GetTasksSortOptions
    columns: ProjectPreferenceVO['columns']
    getTasksOptions: GetTasksOptions
}>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: GetTasksSortOptions): void
}>()

const isSorting = computed(() => props.modelValue.field !== undefined)

const fieldOptions = computed(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(props.columns).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: columnLabels[key as keyof ProjectPreferenceVO],
            value: key,
            checked: props.modelValue.field === key
        })
    })
    return options
})

const orderOptions = computed(() => {
    const options: InnerDropdownOptionVO[] = []
    options.push({
        icon: 'arrow-up',
        label: '升序',
        value: 'asc',
        checked: props.modelValue.order === 'asc'
    })
    options.push({
        icon: 'arrow-down',
        label: '降序',
        value: 'desc',
        checked: props.modelValue.order === 'desc'
    })
    return options
})

const handleFieldDropdownExecute = (field: string) => {
    emit('update:modelValue', {
        field: field as typeof props.modelValue.field,
        order: props.modelValue.order || 'asc'
    })
}

const handleOrderDropdownExecute = (order: string) => {
    emit('update:modelValue', {
        field: props.modelValue.field || 'createdAt',
        order: order === 'desc' ? 'desc' : 'asc'
    })
}
</script>

<template>
    <inner-dropdown
        title="字段"
        icon="select"
        :suffix="isSorting"
        @execute="handleFieldDropdownExecute"
    >
        <inner-dropdown-option
            v-for="option in fieldOptions"
            :key="option.label"
            :icon="option.icon"
            :title="option.label"
            :execute-id="option.value"
            :checked="option.checked"
        />
    </inner-dropdown>
    <inner-dropdown
        title="顺序"
        icon="select"
        :disabled="!isSorting"
        :suffix="isSorting"
        @execute="handleOrderDropdownExecute"
    >
        <inner-dropdown-option
            v-for="option in orderOptions"
            :key="option.label"
            :icon="option.icon"
            :title="option.label"
            :execute-id="option.value"
            :checked="option.checked"
        />
    </inner-dropdown>
</template>

<style scoped></style>
