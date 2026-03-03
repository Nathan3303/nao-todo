<script setup lang="ts">
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '@nao-todo/components'
import { TaskStateSelectOptions } from '@/infrastructure/constants/task'

defineOptions({ name: 'TasksDropdownStateFilter' })
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>()

const states = computed(() => {
    return props.modelValue.split(',')
})

const count = computed(() => {
    return states.value.filter((item) => item).length || 0
})

const dropdownOptions = computed(() => {
    return TaskStateSelectOptions.map((option) => ({
        ...option,
        checked: states.value.includes(option.value)
    }))
})

const handleExecute = (id: string) => {
    if (states.value.includes(id)) {
        states.value.splice(states.value.indexOf(id), 1)
    } else {
        states.value.push(id)
    }
    emit('update:modelValue', states.value.join(','))
}
</script>

<template>
    <inner-dropdown
        title="状态"
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
