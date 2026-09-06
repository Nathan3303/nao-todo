<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineOptions({ name: 'CalendarQuickCreate' })

const props = defineProps<{
    /** 编辑器定位（父按所在格计算 left/width/top） */
    pos: { left: string; width: string; top: string }
    /** 创建请求进行中（Enter 期间防连点；失败保留文本由父保持挂载） */
    pending?: boolean
}>()
const emit = defineEmits<{
    (e: 'submit', name: string): void
    (e: 'cancel'): void
}>()

const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

// @method 回车即建（空名/请求中忽略）
const handleSubmit = () => {
    const name = draft.value.trim()
    if (!name || props.pending) return
    emit('submit', name)
}

// @method 键盘语义：Enter 创建 / Esc 取消
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
    } else if (e.key === 'Escape') {
        emit('cancel')
    }
}

// @method 失焦取消（请求进行中忽略，避免误取消）
const handleBlur = () => {
    if (!props.pending) emit('cancel')
}

onMounted(() => {
    inputEl.value?.focus()
})
</script>

<template>
    <div class="quick-create" :style="pos">
        <input
            ref="inputEl"
            v-model="draft"
            class="quick-create__input"
            type="text"
            placeholder="任务名称"
            :disabled="pending"
            @keydown="handleKeydown"
            @blur="handleBlur"
        />
    </div>
</template>

<style scoped>
.quick-create {
    position: absolute;
    z-index: 30;
    padding: 0 1px;
    box-sizing: border-box;
    pointer-events: auto;
}

.quick-create__input {
    width: 100%;
    height: 16px;
    padding: 0 6px;
    box-sizing: border-box;
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-0);
    color: var(--nue-primary-text-color);
    font-size: 0.75rem;
    line-height: 16px;
    outline: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.quick-create__input:disabled {
    opacity: 0.7;
}
</style>