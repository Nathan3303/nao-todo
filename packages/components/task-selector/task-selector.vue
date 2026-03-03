<script setup lang="ts">
import { computed } from 'vue'
import type { TaskSelectorProps, TaskSelectorEmits } from './types'

defineOptions({ name: 'TaskSelector', inheritAttrs: false })
const props = defineProps<TaskSelectorProps>()
const emit = defineEmits<TaskSelectorEmits>()

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
