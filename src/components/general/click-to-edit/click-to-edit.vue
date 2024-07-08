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
import { NuePrompt, NueMessage } from 'nue-ui'

defineOptions({ name: 'ClickToEdit' })
const props = withDefaults(defineProps<ClickToEditProps>(), {
    emptyholder: 'Click to edit',
    placeholder: 'Input here...',
    title: 'Edit prompt',
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
        () => NueMessage.info('Operation canceled')
    )
}
</script>

<style scoped></style>
