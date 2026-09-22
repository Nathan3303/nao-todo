<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoadingError, t } from '@nao-todo/shared'

defineOptions({ name: 'TaskExportDialog' })

const props = withDefaults(
    defineProps<{
        modelValue: boolean
        markdown?: string
        format?: string
        status?: string
        json?: string
        html?: string
        errorMessage?: string
    }>(),
    {
        markdown: '',
        format: 'markdown',
        status: 'ready',
        json: '',
        html: '',
        errorMessage: ''
    }
)

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'update:format', value: string): void
    (e: 'copy', text: string): void
    (e: 'retry'): void
}>()

// 格式项（顺序即展示顺序）
const FORMATS = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'json', label: 'JSON' },
    { value: 'html', label: 'HTML' }
] as const

// 本地草稿：打开（false→true）时同步为最近一次生成文本；编辑期间不被 props 覆盖（不持久化）
const draft = ref(props.markdown)
const isDirty = ref(false)

watch(
    () => props.modelValue,
    (visible) => {
        if (visible) {
            draft.value = props.markdown
            isDirty.value = false
        }
    }
)

// 流程反转下生成文本在开框后才到达：未编辑时跟随更新，编辑后不覆盖草稿
watch(
    () => props.markdown,
    (value) => {
        if (!isDirty.value) draft.value = value
    }
)

// 用户编辑：标记脏位，之后的 props.markdown 变化不再覆盖
const onDraftInput = (value: string) => {
    isDirty.value = true
    draft.value = value
}

// 「还原」：恢复为最近一次生成文本（props.markdown）
const restore = () => {
    draft.value = props.markdown
    isDirty.value = false
}
// 复制来源随格式：Markdown=编辑后草稿 / JSON=JSON 文本 / HTML=完整文档源码
const copy = () => {
    if (props.format === 'json') return emit('copy', props.json)
    if (props.format === 'html') return emit('copy', props.html)
    return emit('copy', draft.value)
}
</script>

<template>
    <nue-dialog
        :model-value="props.modelValue"
        :title="t('task.details.export.title')"
        theme="task-export"
        @update:model-value="(value) => emit('update:modelValue', Boolean(value))"
    >
        <template #content>
            <loading-error
                v-if="props.status !== 'ready'"
                :loading="props.status === 'loading'"
                :error="props.status === 'error'"
                :loading-message="t('task.details.export.loading')"
                :error-message="props.errorMessage"
            >
                <template #error>
                    <div class="task-export-error">
                        <p class="task-export-error__message">{{ props.errorMessage }}</p>
                        <nue-button theme="primary,small" @click="emit('retry')">
                            {{ t('task.details.export.retry') }}
                        </nue-button>
                    </div>
                </template>
            </loading-error>
            <div v-else class="task-export-content">
                <nue-button-group class="task-export-formats">
                    <nue-button
                        v-for="item in FORMATS"
                        :key="item.value"
                        :data-format="item.value"
                        @click="emit('update:format', item.value)"
                    >
                        {{ item.label }}
                    </nue-button>
                </nue-button-group>
                <nue-textarea
                    v-if="props.format === 'markdown'"
                    :model-value="draft"
                    class="task-export-preview"
                    :autosize="{ minRows: 12, maxRows: 24 }"
                    @update:model-value="onDraftInput"
                />
                <pre v-else-if="props.format === 'json'" class="task-export-json">{{
                    props.json
                }}</pre>
                <iframe
                    v-else
                    class="task-export-html"
                    sandbox=""
                    :srcdoc="props.html"
                    :title="t('task.details.export.title')"
                ></iframe>
            </div>
        </template>
        <template #footer>
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button v-if="props.format === 'markdown'" @click="restore">
                    {{ t('task.details.export.restore') }}
                </nue-button>
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

.task-export-content {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm, 0.5rem);
    min-height: min(60vh, 32rem);
}

.task-export-formats {
    flex: none;
}

.task-export-preview {
    max-height: min(60vh, 32rem);
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --nue-textarea-font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --nue-textarea-font-size: var(--nue-text-sm);
    --nue-textarea-line-height: 1.6;
}

.task-export-json {
    flex: 1 1 auto;
    margin: 0;
    max-height: min(60vh, 32rem);
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--nue-text-sm);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.task-export-html {
    flex: 1 1 auto;
    width: 100%;
    min-height: min(60vh, 32rem);
    border: 1px solid var(--nue-border-color);
}

.task-export-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--nue-gap-sm, 0.5rem);
}

.task-export-error__message {
    margin: 0;
    font-size: var(--nue-text-sm);
}
</style>