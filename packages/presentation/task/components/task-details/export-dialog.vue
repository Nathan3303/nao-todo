<script setup lang="ts">
import { ref, watch } from 'vue'
import { t } from '@nao-todo/shared'

defineOptions({ name: 'TaskExportDialog' })

const props = defineProps<{
    modelValue: boolean
    markdown: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'copy', text: string): void
}>()

// 本地草稿：打开（false→true）时同步为最近一次生成文本；编辑期间不被 props 覆盖（不持久化）
const draft = ref(props.markdown)

watch(
    () => props.modelValue,
    (visible) => {
        if (visible) draft.value = props.markdown
    }
)

const close = () => emit('update:modelValue', false)
// 「还原」：恢复为最近一次生成文本（props.markdown）
const restore = () => (draft.value = props.markdown)
// 复制来源为编辑后的草稿
const copy = () => emit('copy', draft.value)
</script>

<template>
    <nue-dialog
        :model-value="props.modelValue"
        :title="t('task.details.export.title')"
        theme="task-export"
        @update:model-value="(value) => emit('update:modelValue', Boolean(value))"
    >
        <template #content>
            <nue-textarea
                v-model="draft"
                class="task-export-preview"
                :autosize="{ minRows: 12, maxRows: 24 }"
            />
        </template>
        <template #footer>
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button @click="restore">
                    {{ t('task.details.export.restore') }}
                </nue-button>
                <nue-button @click="close">{{ t('task.details.close') }}</nue-button>
                <nue-button theme="primary" @click="copy">
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
    max-height: min(60vh, 32rem);
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --nue-textarea-font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --nue-textarea-font-size: var(--nue-text-sm);
    --nue-textarea-line-height: 1.6;
}
</style>