<script setup lang="ts">
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '@nao-todo/shared'
import { TaskPrioritySelectOptions } from '../../constants'
import { t } from '@nao-todo/shared'

defineOptions({ name: 'TaskPriorityFilter' })
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const priorities = computed(() => props.modelValue.split(','))
const count = computed(() => priorities.value.filter((item) => item).length || 0)
const dropdownOptions = computed(() =>
    TaskPrioritySelectOptions.value.map((option) => ({
        ...option,
        checked: priorities.value.includes(option.value)
    }))
)
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
        :title="t('task.filter.priority')"
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
