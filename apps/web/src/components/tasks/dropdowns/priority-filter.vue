<script setup lang="ts">
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '@nao-todo/components'
import { TaskPrioritySelectOptions } from '@nao-todo/infrastructure/consts/tasks'

defineOptions({ name: 'TasksDropdownPriorityFilter' })
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>()

const priorities = computed(() => {
    return props.modelValue.split(',')
})

const count = computed(() => {
    return priorities.value.filter((item) => item).length || 0
})

const dropdownOptions = computed(() => {
    return TaskPrioritySelectOptions.map((option) => ({
        ...option,
        checked: priorities.value.includes(option.value)
    }))
})

const handleExecute = (id: string) => {
    if (priorities.value.includes(id)) {
        priorities.value.splice(priorities.value.indexOf(id), 1)
    } else {
        priorities.value.push(id)
    }
    emit('update:modelValue', priorities.value.join(','))
}
</script>

<template>
    <inner-dropdown
        title="优先级"
        icon="filter"
        group="tasks-todo-filter"
        :suffix="count"
        :close-when-executed="false"
        @execute="handleExecute"
    >
        <inner-dropdown-option
            v-for="option in dropdownOptions"
            :key="option.label"
            :icon="option.icon"
            :title="option.label"
            :execute-id="option.value"
            :checked="option.checked"
        />
    </inner-dropdown>
</template>

<style scoped></style>
