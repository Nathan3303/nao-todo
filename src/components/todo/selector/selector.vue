<template>
    <nue-select v-model="proxyValue" size="small">
        <nue-select-option
            v-for="option in options"
            :key="option.value"
            :label="option.label"
            :value="option.value"
        ></nue-select-option>
    </nue-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TodoSelectorEmits, TodoSelectorProps } from './types'

defineOptions({ name: 'TodoSelector' })
const props = defineProps<TodoSelectorProps>()
const emit = defineEmits<TodoSelectorEmits>()

const proxyValue = computed({
    get() {
        const { value } = props
        return value
    },
    set(value) {
        emit('change', value)
    }
})
</script>

<style scoped>
/* @import url('./selector.css'); */
</style>
