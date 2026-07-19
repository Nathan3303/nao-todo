<script setup lang="ts">
import {
    DropdownDivBlock,
    InnerDropdown,
    InnerDropdownOption,
    t,
    type InnerDropdownOptionVO
} from '@nao-todo/shared'
import { computed } from 'vue'
import { columnLabels, sortFieldLabels } from '../../constants'
import { GetTasksOptions, GetTasksSortOptions, TaskColumnOptions } from '@nao-todo/shared'

defineOptions({ name: 'TasksDropdownSortOperator' })
const props = defineProps<{
    modelValue: GetTasksSortOptions
    columns: TaskColumnOptions
    getTasksOptions: GetTasksOptions
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: GetTasksSortOptions): void }>()

const isSorting = computed(() => props.modelValue.field !== undefined)

const fieldOptions = computed(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(sortFieldLabels.value).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: columnLabels.value[key as keyof TaskColumnOptions]!,
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
        label: t('task.sort.asc'),
        value: 'asc',
        checked: props.modelValue.order === 'asc'
    })
    options.push({
        icon: 'arrow-down',
        label: t('task.sort.desc'),
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
        :title="t('task.sort.field')"
        icon="select"
        @execute="handleFieldDropdownExecute"
    >
        <dropdown-div-block :title="t('task.sort.selectField')">
            <inner-dropdown-option
                v-for="option in fieldOptions"
                :key="option.label"
                :icon="option.icon"
                :title="option.label"
                :execute-id="option.value"
                :checked="option.checked"
            />
        </dropdown-div-block>
    </inner-dropdown>
    <inner-dropdown
        :title="t('task.sort.order')"
        icon="select"
        :disabled="!isSorting"
        @execute="handleOrderDropdownExecute"
    >
        <dropdown-div-block :title="t('task.sort.selectOrder')">
            <inner-dropdown-option
                v-for="option in orderOptions"
                :key="option.label"
                :icon="option.icon"
                :title="option.label"
                :execute-id="option.value"
                :checked="option.checked"
            />
        </dropdown-div-block>
    </inner-dropdown>
</template>

<style scoped></style>
