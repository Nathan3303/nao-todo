<template>
    <nue-button theme="pure" title="Click to edit" @click="handleEdit">
        <slot>
            <nue-text :size="size" :weight="weight" :color="color">
                {{ text || emptyholder }}
            </nue-text>
        </slot>
    </nue-button>
</template>

<script setup lang="ts">
import type { ClickToEditEmits, ClickToEditProps } from './types'
import { NuePrompt } from 'nue-ui'

defineOptions({ name: 'ClickToEdit' })
const props = withDefaults(defineProps<ClickToEditProps>(), {
    emptyholder: '编辑',
    placeholder: '输入内容...',
    title: '编辑输入框',
    size: '14px',
    color: 'black'
})
const emit = defineEmits<ClickToEditEmits>()

function handleEdit() {
    const { title, placeholder, text, preventDefault } = props
    if (preventDefault) {
        emit('edit', text as string)
        return
    }
    NuePrompt({
        title,
        placeholder,
        confirmButtonText: 'Edit',
        cancelButtonText: 'Cancel',
        inputValue: text,
        validator: (value: any) => value
    }).then(
        (value) => emit('edit', value as string),
        () => {}
    )
}
</script>

<style scoped>
.nue-button:deep(.nue-button__text) {
    text-align: left;
}
</style>
