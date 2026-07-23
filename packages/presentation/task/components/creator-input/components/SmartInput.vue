<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Token } from '../types'
import { getSyntaxHintPlaceholder, renderHighlightedHTML } from '../utils/highlighter'

interface Props {
  modelValue: string
  tokens: Token[]
  placeholder?: string
  autofocus?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'mounted'): void
}>()

// ============== DOM 引用 ==============

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)

// ============== 高亮渲染 ==============

const highlightedHTML = computed(() => renderHighlightedHTML(props.tokens))

// 同步滚动位置
function syncScroll() {
  if (!textareaRef.value || !highlightRef.value) return

  highlightRef.value.scrollTop = textareaRef.value.scrollTop
  highlightRef.value.scrollLeft = textareaRef.value.scrollLeft
}

// ============== 输入处理 ==============

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  emit('input', target.value)
  nextTick(syncScroll)
}

function handleKeydown(event: KeyboardEvent) {
  emit('keydown', event)
}

// ============== 焦点管理 ==============

function focus() {
  textareaRef.value?.focus()
}

function setSelectionRange(start: number, end: number) {
  textareaRef.value?.setSelectionRange(start, end)
}

defineExpose({
  focus,
  setSelectionRange,
  textareaRef
})

// ============== 生命周期 ==============

onMounted(() => {
  // 通知父组件已挂载
  emit('mounted')
  
  // 自动聚焦
  if (props.autofocus) {
    nextTick(() => textareaRef.value?.focus())
  }
})

// ============== 自动调整高度 ==============

const textareaStyle = computed(() => {
  // 自动调整高度的基础样式
  const baseHeight = 44
  return {
    minHeight: `${baseHeight}px`,
    height: 'auto'
  }
})

// 自动调整高度
watch(
  () => props.modelValue,
  () => {
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
        textareaRef.value.style.height = `${Math.max(textareaRef.value.scrollHeight, 44)}px`
      }
    })
  }
)
</script>

<template>
  <div class="smart-input-wrapper">
    <!-- 底层：高亮背景层 -->
    <div
      ref="highlightRef"
      class="smart-input__highlight"
      v-html="highlightedHTML"
    ></div>

    <!-- 顶层：透明文本输入框 -->
    <textarea
      ref="textareaRef"
      class="smart-input__textarea"
      :value="modelValue"
      :placeholder="placeholder || getSyntaxHintPlaceholder()"
      :autofocus="autofocus"
      :style="textareaStyle"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
      @keydown="handleKeydown"
      @scroll="syncScroll"
    />
  </div>
</template>

<style scoped>
.smart-input-wrapper {
  position: relative;
  width: 100%;
}

.smart-input__highlight,
.smart-input__textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: normal;
  border: none;
  border-radius: 8px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow: hidden;
}

/* 高亮层：文字透明，背景可见 */
.smart-input__highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  color: transparent;
  background-color: transparent;
  z-index: 1;
}

/* 文本输入框：背景透明，文字可见 */
.smart-input__textarea {
  position: relative;
  z-index: 2;
  background-color: transparent;
  color: var(--nue-text-color-primary);
  resize: none;
  outline: none;
}

.smart-input__textarea::placeholder {
  color: var(--nue-text-color-placeholder);
  opacity: 0.6;
}

.smart-input__textarea:focus {
  outline: none;
}

/* 确保高亮层的文本换行与输入框一致 */
.smart-input__highlight br {
  line-height: inherit;
}
</style>
