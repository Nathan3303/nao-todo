<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'TasksDropdownTextFilter' })
const props = defineProps<{
    placeholder?: string
    modelValue: string
}>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>()

const inputValue = computed({
    get: () => props.modelValue,
    set: (value) => {
        emit('update:modelValue', value)
    }
})
</script>

<template>
    <nue-input
        theme="pure,small"
        :placeholder="placeholder || '根据名称筛选'"
        v-model="inputValue"
        clearable
        icon="search"
        :debounce-time="360"
        style="width: 100%"
    />
</template>

<style scoped>
.nue-input {
    border: none;
    border-radius: 0;
    --nue-icon-size: var(--nue-text-sm);
    font-size: var(--nue-text-sm);
    padding: 0.25rem 0.75rem;
    gap: 8px;

    &:deep(.nue-input__input) {
        line-height: normal;
    }
}
</style>
