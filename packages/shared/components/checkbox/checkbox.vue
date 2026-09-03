<template>
    <nue-div theme="checkbox" @click="handleCheck">
        <nue-icon theme="checkicon" :name="checked ? 'square-check-fill' : 'square'" />
        <nue-icon v-if="icon" :name="icon" color="gray" />
        <nue-text :clamped="1">{{ label }}</nue-text>
        <nue-div width="auto">
            <nue-text>{{ count }}</nue-text>
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
    gap: var(--nue-gap-xs);
    padding: 0 var(--nue-gap-xs);
    height: var(--nue-box-size-sm);
    flex-wrap: nowrap;
    font-size: var(--nue-text-sm);
    border-radius: var(--nue-primary-radius);

    &:hover {
        background-color: var(--nue-primary-color-200);
        cursor: pointer;
    }

    > .nue-icon--checkicon {
        font-size: 1.25em;
    }
}
</style>