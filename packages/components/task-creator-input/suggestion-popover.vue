<script setup lang="ts">
import { computed } from 'vue'
import type { SuggestionOption, InlineChipType } from './types'

const props = withDefaults(
    defineProps<{
        visible: boolean
        options: SuggestionOption[]
        query: string
        type: InlineChipType | null
        position: { top: number; left: number }
        highlightIndex: number
        canCreate: boolean
    }>(),
    {
        canCreate: true
    }
)

const emit = defineEmits<{
    select: [option: SuggestionOption]
    create: [name: string]
    'update:highlightIndex': [index: number]
}>()

const headerLabel = computed(() => {
    return props.type === 'tag' ? '标签' : '清单'
})

const hasOptions = computed(() => props.options.length > 0)

function handleSelect(option: SuggestionOption) {
    emit('select', option)
}

function handleCreate() {
    emit('create', props.query)
}
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            class="suggestion-popover"
            :style="{ top: position.top + 'px', left: position.left + 'px' }"
            @mousedown.prevent
        >
            <div class="popover-header">{{ headerLabel }}</div>
            <div
                v-for="(opt, i) in options"
                :key="opt.id"
                class="popover-option"
                :class="{ active: i === highlightIndex }"
                @click="handleSelect(opt)"
                @mouseenter="emit('update:highlightIndex', i)"
            >
                <span
                    v-if="type === 'tag'"
                    class="color-dot"
                    :style="{ background: opt.color || '#888' }"
                />
                <span class="label">{{ opt.label }}</span>
                <span v-if="opt.description" class="description">{{ opt.description }}</span>
            </div>
            <div
                v-if="canCreate && type === 'tag' && !hasOptions && query"
                class="popover-create"
                @click="handleCreate"
            >
                创建标签 "{{ query }}"
            </div>
            <div
                v-if="!hasOptions && !(canCreate && type === 'tag' && query)"
                class="popover-empty"
            >
                无匹配
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.suggestion-popover {
    position: fixed;
    z-index: 9999;
    min-width: 160px;
    max-width: 240px;
    max-height: 200px;
    overflow-y: auto;
    background: var(--nue-primary-color-100);
    border: 1px solid var(--nue-primary-color-300);
    border-radius: var(--nue-radius-sm, 6px);
    box-shadow: var(--nue-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12));
    padding: 0.25rem;
}

.popover-header {
    font-size: var(--nue-text-xs, 11px);
    color: var(--nue-primary-color-500);
    padding: 0.25rem 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.popover-option {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    border-radius: calc(var(--nue-radius-sm, 6px) - 1px);
    cursor: pointer;
    font-size: var(--nue-text-sm, 13px);
    transition: background 0.12s ease;

    &:hover,
    &.active {
        background: var(--nue-primary-color-200);
    }

    .color-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .description {
        font-size: var(--nue-text-xs, 11px);
        color: var(--nue-primary-color-500);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 80px;
    }
}

.popover-create {
    padding: 0.5rem;
    font-size: var(--nue-text-sm, 13px);
    color: var(--nue-color-primary, #409eff);
    cursor: pointer;
    text-align: center;
    transition: background 0.12s ease;

    &:hover {
        background: var(--nue-primary-color-200);
    }
}

.popover-empty {
    padding: 0.5rem;
    font-size: var(--nue-text-sm, 13px);
    color: var(--nue-primary-color-500);
    text-align: center;
}
</style>

