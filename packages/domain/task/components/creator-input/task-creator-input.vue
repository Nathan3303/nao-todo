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
import { registry } from './trigger-registry'
import './handlers'
import SuggestionPopover from './suggestion-popover.vue'

defineOptions({ name: 'TaskCreatorInput' })
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
let _skipWatchCount = 0
let chipObserver: MutationObserver | null = null
let blurTimer: ReturnType<typeof setTimeout> | null = null
const hasLooseText = ref(false)

const trigger = reactive<TriggerState>({
    active: false,
    type: null,
    query: '',
    startOffset: 0
})

// ── Chip manager ──
const chipManager = useChipManager()

// ── Current handler for popover ──
const currentHandler = computed(() => {
    if (!trigger.active || !trigger.type) return null
    return registry.getByType(trigger.type) ?? null
})

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
        const node = textNodes[i]!
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

// ── Computed: filtered options via registry ──
const filteredOptions = computed<SuggestionOption[]>(() => {
    if (!trigger.active || !trigger.type) return []
    const handler = registry.getByType(trigger.type)
    if (!handler) return []
    const dataSource = (props as any)[handler.dataSourceKey] ?? []
    return handler.getFilteredOptions(trigger.query, dataSource)
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
        if (
            val.text === '' &&
            val.tags.length === 0 &&
            !val.projectId &&
            !val.priority &&
            !val.state
        ) {
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

    for (const handler of registry.getAll()) {
        const rawVal = val[handler.valueKey]
        if (handler.isSingleValue) {
            if (rawVal) {
                const dataSource = (props as any)[handler.dataSourceKey] ?? []
                const html = handler.buildChipHtmlString(
                    rawVal as string,
                    generateChipId(),
                    dataSource
                )
                if (html) parts.push(html)
            }
        } else {
            if (Array.isArray(rawVal) && rawVal.length) {
                const dataSource = (props as any)[handler.dataSourceKey] ?? []
                for (const id of rawVal as string[]) {
                    const html = handler.buildChipHtmlString(id, generateChipId(), dataSource)
                    if (html) parts.push(html)
                }
            }
        }
    }

    if (val.text) {
        parts.push(val.text)
    }

    return parts.join('')
}

// ── Parse editor content to TaskCreatorInputValue ──
function parseModelValue(): TaskCreatorInputValue {
    const editor = editorRef.value
    if (!editor) return { text: '', tags: [], projectId: null, priority: null, state: null }

    const result: Record<string, any> = { text: '' }
    // Initialize with handler defaults
    for (const handler of registry.getAll()) {
        result[handler.valueKey] = handler.isSingleValue ? null : []
    }

    // Collect chip data
    editor.querySelectorAll<HTMLElement>('.vue-chip-mount').forEach((el) => {
        const chipType = el.dataset.chipType
        const handler = registry.getByType(chipType ?? '')
        if (!handler) return
        const val = handler.extractChipValue(el)
        if (handler.isSingleValue) {
            result[handler.valueKey] = val
        } else {
            result[handler.valueKey].push(val)
        }
    })

    // Collect loose text, skipping chip subtrees
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
            result.text += node.textContent || ''
        }
    }

    return result as TaskCreatorInputValue
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
    // position: fixed 相对于视口，getBoundingClientRect 也返回视口坐标，直接使用
    popoverPosition.top = rect.bottom + 4
    popoverPosition.left = rect.left
}

// ── Chip MutationObserver ──
function setupChipObserver(): void {
    if (!editorRef.value) return
    chipObserver?.disconnect()
    chipObserver = new MutationObserver((mutations) => {
        const hasChipChange = mutations.some((m) => {
            for (const node of m.addedNodes) {
                if (
                    node instanceof HTMLElement &&
                    (node.classList.contains('vue-chip-mount') ||
                        node.querySelector('.vue-chip-mount'))
                )
                    return true
            }
            for (const node of m.removedNodes) {
                if (
                    node instanceof HTMLElement &&
                    (node.classList.contains('vue-chip-mount') ||
                        node.querySelector('.vue-chip-mount'))
                )
                    return true
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

    removeStrayBreaks()
    enforceMaxLength()
    updateTriggerState()
    emitModelValue()
}

function handleCompositionStart(): void {
    isComposing.value = true
}

function handleCompositionEnd(): void {
    isComposing.value = false
}

function handleFocus(): void {
    emit('focus')
}

function handleBlur(): void {
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

    // Case 1: Cursor at start of a text node → previous sibling might be a chip
    if (node.nodeType === Node.TEXT_NODE && offset === 0) {
        const prev = node.previousSibling
        if (prev instanceof HTMLElement && prev.classList.contains('vue-chip-mount')) {
            e.preventDefault()
            chipManager.unmountChipByElement(prev)
            placeCursorAfterChipRemoval(node, 0)
        }
        return
    }

    // Case 2: Cursor in parent element (cursor is between children)
    //         → the child before the cursor might be a chip
    // This is the common case after mountChip places cursor via setStartAfter(span),
    // which puts the cursor in the parent element, NOT in a text node.
    if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
        const prev = node.childNodes[offset - 1]
        if (prev instanceof HTMLElement && prev.classList.contains('vue-chip-mount')) {
            e.preventDefault()
            chipManager.unmountChipByElement(prev)
            // After removal, children shifted; the node that was at `offset` is now at `offset - 1`
            const nextChild = node.childNodes[offset - 1]
            if (nextChild?.nodeType === Node.TEXT_NODE) {
                placeCursorAfterChipRemoval(nextChild, 0)
            } else {
                // No text node after chip → insert zero-width space as cursor anchor
                // to prevent the browser from inserting <br> or other artifacts
                const anchor = document.createTextNode('\u200B')
                if (nextChild) {
                    node.insertBefore(anchor, nextChild)
                } else {
                    node.appendChild(anchor)
                }
                placeCursorAfterChipRemoval(anchor, 0)
            }
        }
    }
}

/**
 * Place cursor at a given container/offset and emit model value update.
 * Shared helper for both case 1 and case 2 of handleBackspaceRemoveChip.
 */
function placeCursorAfterChipRemoval(container: Node, offset: number): void {
    const sel = window.getSelection()
    if (!sel) return
    const newRange = document.createRange()
    newRange.setStart(container, offset)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    removeStrayBreaks()
    emitModelValue()
}

/** Remove direct <br> children that browsers sometimes insert into empty contentEditables */
function removeStrayBreaks(): void {
    if (!editorRef.value) return
    for (let i = editorRef.value.children.length - 1; i >= 0; i--) {
        const child = editorRef.value.children[i]!
        if (child.tagName === 'BR') child.remove()
    }
}

// ── Select / Create ──
function handleSelect(option: SuggestionOption): void {
    if (!editorRef.value) return

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    const range = sel.getRangeAt(0)
    const textNode = range.startContainer
    const endOffset = range.startOffset

    // Delete trigger text
    if (textNode.nodeType === Node.TEXT_NODE && trigger.startOffset >= 0) {
        range.setStart(textNode, trigger.startOffset)
        range.setEnd(textNode, endOffset)
    }

    // Dedup: remove existing chip with same type + entityId
    // 同一实体（如同一个标签、同一个优先级）不可重复出现
    const duplicateChipId = chipManager.findChipByEntity(option.type, option.id)
    if (duplicateChipId) {
        chipManager.unmountChip(duplicateChipId)
    }

    // Single-value: remove existing chip of same type (handles value change)
    const handler = registry.getByType(option.type)
    if (handler?.isSingleValue) {
        const existingChipId = chipManager.findChipByEntityType(handler.type)
        if (existingChipId) {
            chipManager.unmountChip(existingChipId)
        }
    }

    // Insert chip
    const chipData: InlineChipData = {
        chipId: generateChipId(),
        type: option.type,
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
            removeStrayBreaks()
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
            :can-create="currentHandler?.canCreate ?? false"
            :handler="currentHandler"
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
            line-height: 1.65;
        }

        .vue-chip-mount {
            display: inline-flex;
            user-select: none;

            .chip-inner {
                display: inline-flex;
                align-items: center;
                flex: none;
                width: fit-content;
                height: 20px;
                padding: 0 0.375rem;
                border-radius: var(--nue-primary-radius);
                font-size: var(--nue-text-sm);
                cursor: default;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 8rem;
                user-select: none;
                vertical-align: middle;
                margin: 0 2px;
                line-height: 1;

                &.chip-inner--tag {
                    background: var(--chip-color, var(--nue-primary-color-200));
                    color: #fff;
                    opacity: 0.8;

                    &::before {
                        content: '#';
                        margin-right: 0.125rem;
                    }
                }

                &.chip-inner--project {
                    color: var(--chip-color, var(--nue-primary-color-800));
                    background: var(--nue-primary-color-200);

                    &::before {
                        content: '@';
                        margin-right: 0.125rem;
                    }
                }

                &.chip-inner--priority {
                    color: var(--chip-color, var(--nue-primary-color-800));
                    background: var(--nue-primary-color-200);

                    &::before {
                        content: '!';
                        margin-right: 0.125rem;
                    }
                }

                &.chip-inner--state {
                    color: var(--chip-color, var(--nue-primary-color-800));
                    background: var(--nue-primary-color-200);

                    &::before {
                        content: '~';
                        margin-right: 0.125rem;
                    }
                }
            }
        }
    }
}
</style>
