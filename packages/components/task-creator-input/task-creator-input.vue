<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type {
    TaskCreatorInputProps,
    TaskCreatorInputEmits,
    TaskCreatorInputValue,
    TriggerState,
    SuggestionOption,
    InlineChipData
} from './types'
import { detectTrigger, getTextBeforeCursor, generateChipId } from './use-mention-parser'
import { useChipManager } from './use-chip-manager'
import SuggestionPopover from './suggestion-popover.vue'

const defaultPriorityOptions = [
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
]

const defaultStateOptions = [
    { label: 'Todo', value: 'todo' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Done', value: 'done' }
]

const props = withDefaults(defineProps<TaskCreatorInputProps>(), {
    placeholder: '',
    disabled: false,
    maxLength: 256,
    autofocus: false
})

const emit = defineEmits<TaskCreatorInputEmits>()

// ── DOM refs ──
const wrapperRef = ref<HTMLElement | null>(null)
const editorRef = ref<HTMLElement | null>(null)

// ── State ──
const isComposing = ref(false)
const highlightIndex = ref(0)
const popoverPosition = reactive({ top: 0, left: 0 })
let _skipWatchCount = 0 // 计数器，跳过自身 emit 触发的 watch
let chipObserver: MutationObserver | null = null
let blurTimer: ReturnType<typeof setTimeout> | null = null
const hasLooseText = ref(false) // 是否有实质文本（用于控制 placeholder 显示）

const trigger = reactive<TriggerState>({
    active: false,
    type: null,
    query: '',
    startOffset: 0
})

// ── Chip manager ──
const chipManager = useChipManager()

// ── 长度限制 ──
function enforceMaxLength(): void {
    if (!editorRef.value) return
    const fullText = editorRef.value.textContent || ''
    if (fullText.length <= props.maxLength) return
    let charsToRemove = fullText.length - props.maxLength
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(editorRef.value, NodeFilter.SHOW_TEXT, null)
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)
    for (let i = textNodes.length - 1; i >= 0 && charsToRemove > 0; i--) {
        const node = textNodes[i]
        const text = node.textContent || ''
        if (text.length <= charsToRemove) {
            node.textContent = ''
            charsToRemove -= text.length
        } else {
            node.textContent = text.slice(0, text.length - charsToRemove)
            charsToRemove = 0
        }
    }
}

// ── Computed: filtered options ──
const filteredOptions = computed<SuggestionOption[]>(() => {
    if (!trigger.active || !trigger.type) return []
    const q = trigger.query.toLowerCase()

    if (trigger.type === 'tag') {
        return props.tags
            .filter((t) => t.name.toLowerCase().includes(q))
            .map((t) => ({
                id: t.id,
                label: t.name,
                type: 'tag' as const,
                color: t.color
            }))
    }

    if (trigger.type === 'project') {
        return props.projects
            .filter((p) => p.name.toLowerCase().includes(q))
            .map((p) => ({
                id: p.id,
                label: p.name,
                type: 'project' as const
            }))
    }

    if (trigger.type === 'priority') {
        const options = props.priorityOptions || defaultPriorityOptions
        return options
            .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
            .map((o) => ({
                id: o.value,
                label: o.label,
                type: 'priority' as const
            }))
    }

    if (trigger.type === 'state') {
        const options = props.stateOptions || defaultStateOptions
        return options
            .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
            .map((o) => ({
                id: o.value,
                label: o.label,
                type: 'state' as const
            }))
    }

    return []
})

// ── Watch modelValue for external reset / preload ──
watch(
    () => props.modelValue,
    (val) => {
        if (!editorRef.value) return
        if (_skipWatchCount > 0) {
            _skipWatchCount--
            return
        }
        // Empty → clear
        if (val.text === '' && val.tags.length === 0 && !val.projectId && !val.priority && !val.state) {
            editorRef.value.innerHTML = ''
            chipManager.destroy()
            return
        }
        // Non-empty with chip data → rebuild content (preload from parent)
        rebuildContent(val)
    },
    { deep: true }
)

/** 重建编辑器内容（用于 preload 或外部重置） */
function rebuildContent(val: TaskCreatorInputValue): void {
    if (!editorRef.value) return
    teardownChipObserver()
    chipManager.destroy()
    editorRef.value.innerHTML = buildInnerHtml(val)
    nextTick(() => {
        chipManager.reconcile(editorRef.value!)
        setupChipObserver()
        emitModelValue()
    })
}

// ── Initialize editor from modelValue ──
function initEditor(): void {
    const editor = editorRef.value
    if (!editor) return
    editor.innerHTML = buildInnerHtml(props.modelValue)
}

function buildInnerHtml(val: TaskCreatorInputValue): string {
    const parts: string[] = []

    // Reconstruct chips from tags
    for (const tagId of val.tags) {
        const tag = props.tags.find((t) => t.id === tagId)
        if (tag) {
            const chipId = generateChipId()
            const colorAttr = tag.color ? ` data-color="${tag.color}"` : ''
            parts.push(
                `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="tag" data-entity-id="${tag.id}" data-label="${tag.name}"${colorAttr}></span>`
            )
        }
    }

    // Reconstruct project chip
    if (val.projectId) {
        const project = props.projects.find((p) => p.id === val.projectId)
        if (project) {
            const chipId = generateChipId()
            parts.push(
                `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="project" data-entity-id="${project.id}" data-label="${project.name}"></span>`
            )
        }
    }

    // Reconstruct priority chip
    if (val.priority) {
        const po = (props.priorityOptions || defaultPriorityOptions).find(
            (o) => o.value === val.priority
        )
        if (po) {
            const chipId = generateChipId()
            parts.push(
                `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="priority" data-entity-id="${po.value}" data-label="${po.label}"></span>`
            )
        }
    }

    // Reconstruct state chip
    if (val.state) {
        const so = (props.stateOptions || defaultStateOptions).find((o) => o.value === val.state)
        if (so) {
            const chipId = generateChipId()
            parts.push(
                `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="state" data-entity-id="${so.value}" data-label="${so.label}"></span>`
            )
        }
    }

    // Text after all chips
    if (val.text) {
        parts.push(val.text)
    }

    return parts.join('')
}

// ── Parse editor content to TaskCreatorInputValue ──
function parseModelValue(): TaskCreatorInputValue {
    const editor = editorRef.value
    if (!editor) return { text: '', tags: [], projectId: null, priority: null, state: null }

    let text = ''
    const tags: string[] = []
    let projectId: string | null = null
    let priority: string | null = null
    let state: string | null = null

    // 单独收集 chip 数据（避免 TreeWalker 走入 chip 内部误取文本）
    editor.querySelectorAll<HTMLElement>('.vue-chip-mount').forEach((el) => {
        const type = el.dataset.chipType
        const eid = el.dataset.entityId
        if (type === 'tag' && eid) tags.push(eid)
        if (type === 'project' && eid && !projectId) projectId = eid
        if (type === 'priority' && eid && !priority) priority = eid
        if (type === 'state' && eid && !state) state = eid
    })

    // 收集 loose text，跳过 chip 子树
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL, {
        acceptNode(node) {
            if (node instanceof HTMLElement && node.classList.contains('vue-chip-mount')) {
                return NodeFilter.FILTER_REJECT
            }
            return NodeFilter.FILTER_ACCEPT
        }
    })
    while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || ''
        }
    }

    return { text: text.trim(), tags, projectId, priority, state }
}

function emitModelValue(): void {
    const val = parseModelValue()
    _skipWatchCount++
    emit('update:modelValue', val)
    hasLooseText.value = val.text !== ''
}

// ── Trigger state management ──
function updateTriggerState(): void {
    const textBefore = getTextBeforeCursor()
    const result = detectTrigger(textBefore, isComposing.value)

    trigger.active = result.active
    trigger.type = result.type
    trigger.query = result.query
    trigger.startOffset = result.startOffset
    highlightIndex.value = 0

    if (result.active) {
        updatePopoverPosition()
    }
}

function resetTrigger(): void {
    trigger.active = false
    trigger.type = null
    trigger.query = ''
    trigger.startOffset = 0
    highlightIndex.value = 0
}

function updatePopoverPosition(): void {
    if (!wrapperRef.value) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.isCollapsed) {
        popoverPosition.top = 0
        popoverPosition.left = 0
        return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = wrapperRef.value.getBoundingClientRect()
    popoverPosition.top = rect.bottom - containerRect.top + 4
    popoverPosition.left = rect.left - containerRect.left
}

// ── Chip MutationObserver（替代每次 input 调用 reconcile）──
function setupChipObserver(): void {
    if (!editorRef.value) return
    chipObserver?.disconnect()
    chipObserver = new MutationObserver((mutations) => {
        const hasChipChange = mutations.some((m) => {
            for (const node of m.addedNodes) {
                if (node instanceof HTMLElement && (node.classList.contains('vue-chip-mount') || node.querySelector('.vue-chip-mount'))) return true
            }
            for (const node of m.removedNodes) {
                if (node instanceof HTMLElement && (node.classList.contains('vue-chip-mount') || node.querySelector('.vue-chip-mount'))) return true
            }
            return false
        })
        if (hasChipChange && editorRef.value) {
            chipManager.reconcile(editorRef.value)
        }
    })
    chipObserver.observe(editorRef.value, { childList: true, subtree: true })
}

function teardownChipObserver(): void {
    chipObserver?.disconnect()
    chipObserver = null
}

// ── Event handlers ──
function handleInput(): void {
    if (isComposing.value) return
    if (!editorRef.value) return

    enforceMaxLength()
    updateTriggerState()
    emitModelValue()
}

function handleCompositionStart(): void {
    isComposing.value = true
}

function handleCompositionEnd(): void {
    isComposing.value = false
    // IME 结束后的 input 事件会触发 handleInput
}

function handleFocus(): void {
    emit('focus')
}

function handleBlur(): void {
    // 延迟触发 blur，让点击弹窗等操作先触发
    if (blurTimer) clearTimeout(blurTimer)
    blurTimer = setTimeout(() => {
        emit('blur')
        blurTimer = null
    }, 150)
}

function handlePaste(e: ClipboardEvent): void {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') || ''
    if (!text) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    // 直接调用 handleInput 而不是 dispatchEvent，避免重复
    handleInput()
}

function handleKeydown(e: KeyboardEvent): void {
    if (trigger.active) {
        handleKeydownWithTrigger(e)
    } else {
        handleKeydownWithoutTrigger(e)
    }
}

function handleKeydownWithTrigger(e: KeyboardEvent): void {
    switch (e.key) {
        case 'Enter':
        case 'Tab':
            e.preventDefault()
            if (filteredOptions.value[highlightIndex.value]) {
                handleSelect(filteredOptions.value[highlightIndex.value]!)
            }
            break
        case 'ArrowUp':
            e.preventDefault()
            highlightIndex.value = Math.max(0, highlightIndex.value - 1)
            break
        case 'ArrowDown':
            e.preventDefault()
            highlightIndex.value = Math.min(
                filteredOptions.value.length - 1,
                highlightIndex.value + 1
            )
            break
        case 'Escape':
            e.preventDefault()
            resetTrigger()
            break
    }
}

function handleKeydownWithoutTrigger(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
        // 回车在 contentEditable 内插入换行，不阻止
        return
    }

    if (e.key === 'Backspace') {
        handleBackspaceRemoveChip(e)
    }
}

function handleBackspaceRemoveChip(e: KeyboardEvent): void {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    const offset = range.startOffset

    // 光标在文本节点开头 → 前一个节点可能是 chip
    if (node.nodeType === Node.TEXT_NODE && offset === 0) {
        const prev = node.previousSibling
        if (prev instanceof HTMLElement && prev.classList.contains('vue-chip-mount')) {
            e.preventDefault()
            const chipId = chipManager.unmountChipByElement(prev)
            if (chipId) {
                // 光标移到 chip 位置
                const newRange = document.createRange()
                newRange.setStart(node, 0)
                newRange.collapse(true)
                sel.removeAllRanges()
                sel.addRange(newRange)
                emitModelValue()
            }
        }
    }
}

// ── Select / Create ──
function handleSelect(option: SuggestionOption): void {
    if (!editorRef.value) return

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    const range = sel.getRangeAt(0)

    // 删除触发文本
    const textNode = range.startContainer
    const endOffset = range.startOffset
    const deleteStart = trigger.startOffset

    if (textNode.nodeType === Node.TEXT_NODE && deleteStart >= 0) {
        range.setStart(textNode, deleteStart)
        range.setEnd(textNode, endOffset)
    }

    // priority 和 state 是单值，先移除同类型的旧 chip
    if (trigger.type === 'priority' || trigger.type === 'state') {
        const existingChipId = chipManager.findChipByEntityType(trigger.type)
        if (existingChipId) {
            chipManager.unmountChip(existingChipId)
        }
    }

    // 插入 chip
    const chipData: InlineChipData = {
        chipId: generateChipId(),
        type: trigger.type!,
        entityId: option.id,
        label: option.label,
        color: option.color
    }

    chipManager.mountChip(chipData, range)

    resetTrigger()
    emitModelValue()
    editorRef.value.focus()
}

function handleCreateTag(name: string): void {
    emit('create-tag', name)
    resetTrigger()
}

// ── Lifecycle ──
onMounted(() => {
    if (editorRef.value) {
        initEditor()
        nextTick(() => {
            chipManager.reconcile(editorRef.value!)
            setupChipObserver()
            if (props.autofocus) {
                editorRef.value?.focus()
            }
        })
    }
})

onBeforeUnmount(() => {
    if (blurTimer) clearTimeout(blurTimer)
    teardownChipObserver()
    chipManager.destroy()
})

// ── Expose for parent ──
defineExpose({
    focus: () => editorRef.value?.focus(),
    clear: () => {
        if (editorRef.value) {
            teardownChipObserver()
            editorRef.value.innerHTML = ''
            chipManager.destroy()
            setupChipObserver()
        }
    }
})
</script>

<template>
    <div ref="wrapperRef" class="task-creator-input">
        <div
            ref="editorRef"
            class="contenteditable-input"
            :class="{ 'has-placeholder': !hasLooseText, 'is-disabled': props.disabled }"
            :contenteditable="!props.disabled"
            :placeholder="placeholder"
            @input="handleInput"
            @keydown="handleKeydown"
            @focus="handleFocus"
            @blur="handleBlur"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
            @paste="handlePaste"
        ></div>
        <SuggestionPopover
            :visible="trigger.active"
            :options="filteredOptions"
            :query="trigger.query"
            :type="trigger.type"
            :position="popoverPosition"
            :highlight-index="highlightIndex"
            :can-create="trigger.type === 'tag'"
            @select="handleSelect"
            @create="handleCreateTag"
            @update:highlight-index="highlightIndex = $event"
        />
    </div>
</template>

<style>
.task-creator-input {
    position: relative;
    width: 100%;

    .contenteditable-input {
        width: 100%;
        color: var(--nue-primary-color-900);
        font-size: var(--nue-text-df2);
        line-height: 1.65;
        outline: none;
        cursor: text;
        word-break: break-all;
        box-sizing: border-box;
        transition: border-color 0.2s ease;

        &.is-disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        &.has-placeholder::after {
            content: attr(placeholder);
            color: var(--nue-primary-color-500);
            pointer-events: none;
            user-select: none;
            vertical-align: middle;
            line-height: 1.65;
        }

        .vue-chip-mount {
            display: inline-block;
            vertical-align: middle;
            user-select: none;

            .chip-inner {
                display: inline-flex;
                align-items: center;
                flex: none;
                width: fit-content;
                height: 24px;
                padding: 0 0.5rem;
                border-radius: var(--nue-primary-radius);
                font-size: var(--nue-text-sm);
                line-height: 1;
                cursor: default;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 8rem;
                user-select: none;
                vertical-align: middle;
                margin: 0 2px;

                &.chip-inner--tag {
                    background: var(--chip-color, var(--nue-primary-color-200));
                    color: #fff;
                    letter-spacing: 0.02em;

                    &::before {
                        content: '#';
                        margin-right: 0.125rem;
                        opacity: 0.8;
                    }
                }

                &.chip-inner--project {
                    color: var(--nue-primary-color-800);
                    background: var(--chip-color, var(--nue-primary-color-300));

                    &::before {
                        content: '清单：';
                        display: inline-block;
                        margin-right: 0.125rem;
                        opacity: 0.8;
                    }
                }

                &.chip-inner--priority {
                    background: var(--chip-color, #95a5a6);
                    color: #fff;
                    font-weight: 500;

                    &::before {
                        content: '!';
                        margin-right: 0.125rem;
                        opacity: 0.8;
                    }
                }

                &.chip-inner--state {
                    background: var(--chip-color, #7f8c8d);
                    color: #fff;
                    font-weight: 500;

                    &::before {
                        content: '~';
                        margin-right: 0.125rem;
                        opacity: 0.8;
                    }
                }
            }
        }
    }
}
</style>

