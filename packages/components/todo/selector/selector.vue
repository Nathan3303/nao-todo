<template>
    <nue-select v-model="proxyValue" size="small" v-bind="$attrs">
        <nue-select-option
            v-for="option in options"
            :key="option.value"
            :label="option.label"
            :value="option.value"
        />
    </nue-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'TodoSelector' })
const props = defineProps<{
    value: unknown
    options?: {
        label: string
        value: unknown
        disabled?: boolean
    }[]
}>()
const emit = defineEmits<{
    (event: 'change', value: unknown): void
}>()

const proxyValue = computed({
    get: () => props.value,
    set: (value) => emit('change', value)
})
</script>
