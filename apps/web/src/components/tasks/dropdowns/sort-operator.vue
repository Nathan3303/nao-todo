<script setup lang="ts">
import { computed } from 'vue'
import {
    InnerDropdown,
    InnerDropdownOption,
    type InnerDropdownOptionVO,
    DropdownDivBlock
} from '@nao-todo/components'
import type {
    GetTasksOptions,
    GetTasksSortOptions,
    ProjectPreferenceViewObject
} from '@nao-todo/types'
import { columnLabels, sortFieldLabels } from '@nao-todo/infrastructure/consts/tasks'

defineOptions({ name: 'TasksDropdownSortOperator' })
const props = defineProps<{
    modelValue: GetTasksSortOptions
    columns: ProjectPreferenceViewObject['columns']
    getTasksOptions: GetTasksOptions
}>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: GetTasksSortOptions): void
}>()

const isSorting = computed(() => props.modelValue.field !== undefined)

const fieldOptions = computed(() => {
    const options: InnerDropdownOptionVO[] = []
    Object.keys(sortFieldLabels).forEach((key) => {
        options.push({
            icon: 'plus-circle',
            label: columnLabels[key as keyof ProjectPreferenceViewObject['columns']],
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
    <inner-dropdown title="排序字段" icon="select" @execute="handleFieldDropdownExecute">
        <dropdown-div-block title="选择排序字段">
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
        title="排序顺序"
        icon="select"
        :disabled="!isSorting"
        @execute="handleOrderDropdownExecute"
    >
        <dropdown-div-block title="选择排序顺序">
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

