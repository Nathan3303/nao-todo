<template>
    <nue-div theme="checkbox" @click="handleCheck">
        <nue-icon theme="checkicon" :name="checked ? 'square-check-fill' : 'square'" />
        <nue-icon v-if="icon" size="18px" :name="icon" color="gray" />
        <nue-text :clamped="1" size="13px">{{ label }}</nue-text>
        <nue-div width="auto">
            <nue-text size="14px">{{ count }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CheckboxProps, CheckboxEmits } from './types'

defineOptions({ name: 'Checkbox' })
const props = defineProps<CheckboxProps>()
const emit = defineEmits<CheckboxEmits>()

const checked = ref(props.checked)

const handleCheck = () => {
    checked.value = !checked.value
    emit('check', checked.value, props.value)
}
</script>

<style scoped>
.nue-div--checkbox {
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    height: 32px;
    opacity: 0.96;
    flex-wrap: nowrap;

    &:hover {
        background-color: var(--nue-primary-color-200);
        border-radius: var(--primary-radius);
        cursor: pointer;
    }

    > .nue-icon--checkicon {
        font-size: 1.25rem;
    }
}
</style>

