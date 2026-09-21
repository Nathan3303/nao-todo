<script setup lang="ts">
import { t } from '@nao-todo/shared'

defineOptions({ name: 'TaskExportDialog' })

const props = defineProps<{
    modelValue: boolean
    markdown: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'copy'): void
}>()

const close = () => emit('update:modelValue', false)
</script>

<template>
    <nue-dialog
        :model-value="props.modelValue"
        :title="t('task.details.export.title')"
        theme="task-export"
        @update:model-value="(value) => emit('update:modelValue', Boolean(value))"
    >
        <template #content>
            <pre class="task-export-preview">{{ markdown }}</pre>
        </template>
        <template #footer>
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button @click="close">{{ t('task.details.close') }}</nue-button>
                <nue-button theme="primary" @click="emit('copy')">
                    {{ t('task.details.export.copy') }}
                </nue-button>
            </nue-div>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--task-export {
    width: min(90vw, 40rem);
}

.task-export-preview {
    margin: 0;
    max-height: min(60vh, 32rem);
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--nue-text-sm);
    line-height: 1.6;
}
</style>