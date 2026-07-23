<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TaskCreatorInputValue } from './types'
import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import type { SelectOption } from './types'
import SmartInput from './components/SmartInput.vue'
import AutocompletePopover from './components/AutocompletePopover.vue'
import ParsedChips from './components/ParsedChips.vue'
import useSmartParser from './composables/useSmartParser'
import useAutocomplete from './composables/useAutocomplete'
import useKeyboardNav from './composables/useKeyboardNav'

// ============== Props / Emits ==============

interface Props {
  modelValue: TaskCreatorInputValue
  tags: TaskTagViewObject[]
  projects: TaskProjectViewObject[]
  priorityOptions: SelectOption[]
  stateOptions: SelectOption[]
  placeholder?: string
  autofocus?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: TaskCreatorInputValue): void
  (e: 'create-tag', name: string): void
  (e: 'submit'): void
}>()

// ============== 内部引用 ==============

const smartInputRef = ref<InstanceType<typeof SmartInput> | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)

// ============== 组合式函数 ==============

// 1. 智能解析器
const modelValueRef = computed(() => props.modelValue)
const tagsRef = computed(() => props.tags)
const projectsRef = computed(() => props.projects)
const priorityOptionsRef = computed(() => props.priorityOptions)
const stateOptionsRef = computed(() => props.stateOptions)

// 包装 onInput，每次输入后检查自动补全触发
function handleInputChange(text: string) {
  onInput(text)
  // 确保引用已同步
  syncInputRef()
  // 检查自动补全触发
  nextTick(() => checkTrigger())
}

const {
  rawText,
  tokens,
  resolvedTags,
  resolvedProjectId,
  resolvedPriority,
  resolvedState,
  onInput,
  insertAtPosition,
  forceParse
} = useSmartParser({
  modelValue: modelValueRef,
  tags: tagsRef,
  projects: projectsRef,
  priorityOptions: priorityOptionsRef,
  stateOptions: stateOptionsRef,
  emit
})

// 2. 自动补全
const {
  isOpen: isAutocompleteOpen,
  suggestions,
  activeIndex,
  triggerLabel,
  inputRef: autocompleteInputRef,
  checkTrigger,
  close: closeAutocomplete,
  selectItem,
  handleKeydown: handleAutocompleteKeydown
} = useAutocomplete({
  rawText,
  tags: tagsRef,
  projects: projectsRef,
  priorityOptions: priorityOptionsRef,
  stateOptions: stateOptionsRef,
  onSelect: (item, trigger) => {
    // 选择后替换文本
    const triggerChar = trigger.type === 'tag' ? '#' : trigger.type === 'project' ? '@' : trigger.type === 'priority' ? '!' : '~'
    const replacement = `${triggerChar}${item.label}`
    const newText = insertAtPosition(trigger.start, trigger.end, replacement)
    rawText.value = newText

    // 更新光标位置到新插入文本的末尾
    const newCursorPos = trigger.start + replacement.length + 1 // +1 为插入的空格
    nextTick(() => {
      smartInputRef.value?.setSelectionRange(newCursorPos, newCursorPos)
    })
  },
  onCreateTag: (name) => emit('create-tag', name)
})

// 3. 键盘导航
const { handleKeydown: handleNavKeydown } = useKeyboardNav({
  rawText,
  inputRef: autocompleteInputRef as any,
  onTextChange: onInput
})

// ============== 事件处理 ==============

/**
 * 统一处理键盘事件
 */
function handleKeydown(event: KeyboardEvent) {
  // 优先处理自动补全键盘事件
  const consumedByAutocomplete = handleAutocompleteKeydown(event)
  if (consumedByAutocomplete) return

  // 处理其他键盘导航
  handleNavKeydown(event, isAutocompleteOpen.value)

  // Ctrl/Cmd + Enter 提交
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    forceParse()
    emit('submit')
  }
}

/**
 * 处理输入框焦点
 */
function handleFocus() {
  // 延迟检查触发，确保 selection 已更新
  requestAnimationFrame(() => checkTrigger())
}

/**
 * 点击外部区域
 */
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const isInsideWrapper = wrapperRef.value?.contains(target)
  const isPopover = target.closest('[data-autocomplete-popover]')

  if (!isInsideWrapper && !isPopover) {
    closeAutocomplete()
  }
}

// ============== 同步输入框引用 ==============

// 定期同步 textarea 引用（因为 SmartInput 内部的 ref 可能延迟挂载）
function syncInputRef() {
  nextTick(() => {
    if (smartInputRef.value) {
      const textarea = (smartInputRef.value as any).textareaRef?.value
      if (textarea) {
        autocompleteInputRef.value = textarea
      }
    }
  })
}

// 监听自动补全输入框引用变化
watch(autocompleteInputRef, (newVal) => {
  // ref 已更新
})

// ============== 生命周期 ==============

onMounted(() => {
  // 同步 textarea 引用
  syncInputRef()

  // 绑定全局点击事件用于关闭弹出层
  document.addEventListener('click', handleClickOutside)

  // 自动聚焦
  if (props.autofocus) {
    nextTick(() => smartInputRef.value?.focus())
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// ============== 暴露方法 ==============

defineExpose({
  focus: () => smartInputRef.value?.focus(),
  forceParse,
  rawText
})
</script>

<template>
  <div ref="wrapperRef" class="task-creator-input-wrapper">
    <!-- 输入框容器 -->
    <div class="input-container" :class="{ 'input-container--focused': isAutocompleteOpen }">
      <!-- 智能输入框（带高亮） -->
      <SmartInput
        ref="smartInputRef"
        v-model="rawText"
        :tokens="tokens"
        :placeholder="placeholder"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @input="handleInputChange"
        @mounted="syncInputRef"
      />

      <!-- 自动补全弹出层 -->
      <AutocompletePopover
        :visible="isAutocompleteOpen"
        :suggestions="suggestions"
        :active-index="activeIndex"
        :type="currentTrigger?.type || ''"
        @select="selectItem"
        @close="closeAutocomplete"
      />
    </div>

    <!-- 解析结果预览 Chips -->
    <ParsedChips
      :tags="resolvedTags"
      :project-id="resolvedProjectId"
      :priority="resolvedPriority"
      :state="resolvedState"
      :available-tags="tags"
      :available-projects="projects"
    />
  </div>
</template>

<style scoped>
.task-creator-input-wrapper {
  width: 100%;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 10px;
  overflow: hidden;
  background-color: #ffffff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.task-creator-input-wrapper:focus-within {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-container {
  position: relative;
  width: 100%;
}

.input-container--focused {
  z-index: 10;
}
</style>
