<script setup lang="ts">
import { computed } from 'vue'

type TodoSelectorOptionValue = string | number
type TodoSelectorOption = {
    label: string
    value: TodoSelectorOptionValue
    disabled?: boolean
}
type TodoSelectorProps = {
    value?: TodoSelectorOptionValue
    options?: TodoSelectorOption[]
    placeholder?: string
}
type TodoSelectorEmits = {
    (event: 'change', value?: TodoSelectorOptionValue): void
}

defineOptions({ name: 'TodoSelector', inheritAttrs: false })
const props = defineProps<TodoSelectorProps>()
const emit = defineEmits<TodoSelectorEmits>()

const vm = computed({
    get: () => props.value,
    set: (value) => emit('change', value)
})
</script>

<template>
    <nue-select v-model="vm" size="small" :placeholder="placeholder" v-bind="$attrs">
        <nue-select-option
            v-for="option in options"
            :key="option.label"
            :label="option.label"
            :value="option.value"
            :disabled="option.disabled"
        />
    </nue-select>
</template>

