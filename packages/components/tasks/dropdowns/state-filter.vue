<script setup lang="ts">
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '../../inner-dropdown'
import { TaskStateSelectOptions } from '@nao-todo/infrastructure/consts/tasks'
import { t } from '@nao-todo/infrastructure/locales'

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
    return TaskStateSelectOptions.value.map((option) => ({
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
        :title="t('task.filter.state')"
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

