<template>
    <nue-button theme="pure" title="点击修改" @click="handleEdit">
        <slot>
            <nue-text :size="size" :weight="weight" :color="color">
                {{ text || emptyholder }}
            </nue-text>
        </slot>
    </nue-button>
</template>

<script setup lang="ts">
import { NuePrompt } from 'nue-ui'

defineOptions({ name: 'ClickToEdit' })
const props = withDefaults(
    defineProps<{
        text?: string
        placeholder?: string
        title?: string
        preventDefault?: boolean
        size?: string
        color?: string
        weight?: string
        emptyholder?: string
    }>(),
    {
        emptyholder: '编辑',
        placeholder: '输入内容...',
        title: '编辑框',
        size: '14px',
        color: 'black'
    }
)
const emit = defineEmits<{
    (event: 'edit', payload: string): void
}>()

const handleEdit = () => {
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
        (e) => console.log('[ClickToEdit/handleEdit] NuePromptCanceled:', e)
    )
}
</script>

<style scoped>
.nue-button:deep(.nue-button__text) {
    text-align: left;
}
</style>
