<template>
    <nue-select v-model="proxyValue" size="small" v-bind="$attrs">
        <nue-select-option
            v-for="option in options"
            :key="option.label"
            :label="option.label"
            :value="option.value as never"
        />
    </nue-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'TodoSelector' })
const props = defineProps<{
    value?: string | number
    options?: {
        label: string
        value: string | number
        disabled?: boolean
    }[]
}>()
const emit = defineEmits<{
    (event: 'change', value?: string | number): void
}>()

const proxyValue = computed({
    get: () => props.value,
    set: (value) => emit('change', value)
})
</script>

