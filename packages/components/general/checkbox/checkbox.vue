<template>
    <nue-div class="checkbox" @click="handleCheck">
        <nue-icon size="18px" :name="checked ? 'square-check-fill' : 'square'" />
        <nue-icon v-if="icon" size="18px" :name="icon" color="gray" />
        <nue-text size="13px" style="flex: auto">{{ label }}</nue-text>
        <nue-div width="auto">
            <nue-text size="14px" weight="400">{{ count }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'Checkbox' })
const props = defineProps<{
    checked?: boolean
    label: string
    value: unknown
    icon?: string
    count?: string | number
}>()
const emit = defineEmits<{
    (event: 'check', checked: boolean, value: unknown): void
}>()

const checked = ref(props.checked)

function handleCheck() {
    checked.value = !checked.value
    emit('check', checked.value, props.value)
}
</script>

<style scoped>
.checkbox {
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    height: 32px;
    opacity: 0.96;

    &:hover {
        background-color: #f5f5f5;
        border-radius: var(--primary-radius);
        cursor: pointer;
    }
}
</style>
