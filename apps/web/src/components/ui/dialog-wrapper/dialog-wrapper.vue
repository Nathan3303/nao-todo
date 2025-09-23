<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NueDialog } from 'nue-ui'
import type { DialogWrapperProps, DialogWrapperEmits } from './types'
import type { ComponentRef } from '@nao-todo/types'

defineOptions({ name: 'DialogWrapper' })
const props = defineProps<DialogWrapperProps>()
const emit = defineEmits<DialogWrapperEmits>()

const dialogRef = ref<ComponentRef<typeof NueDialog>>()

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

defineExpose({ dialogRef })
</script>

<template>
    <nue-dialog :theme="['loader', theme]" v-model="visible" ref="dialogRef">
        <template #header="{ close }">
            <slot name="header">
                <nue-text>{{ title }}</nue-text>
                <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
            </slot>
        </template>
        <template #content>
            <slot />
        </template>
        <template #footer>
            <slot name="footer" />
        </template>
    </nue-dialog>
</template>

<style scoped></style>
