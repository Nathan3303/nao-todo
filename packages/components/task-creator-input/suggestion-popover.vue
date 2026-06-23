<script setup lang="ts">
import { computed } from 'vue'
import type { SuggestionOption, InlineChipType } from './types'
import type { TriggerHandler } from './trigger-registry'

const props = withDefaults(
    defineProps<{
        visible: boolean
        options: SuggestionOption[]
        query: string
        type: InlineChipType | null
        position: { top: number; left: number }
        highlightIndex: number
        canCreate: boolean
        handler?: TriggerHandler | null
    }>(),
    {
        canCreate: true,
        handler: null
    }
)

const emit = defineEmits<{
    select: [option: SuggestionOption]
    create: [name: string]
    'update:highlightIndex': [index: number]
}>()

const headerLabel = computed(() => {
    if (props.handler?.headerLabel) return props.handler.headerLabel
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
                <span class="label">{{ opt.label }}</span>
                <span
                    v-if="type === 'tag'"
                    class="color-dot"
                    :style="{ background: opt.color || '#888' }"
                />
            </div>
            <div
                v-if="handler?.canCreate && !hasOptions && query"
                class="popover-create"
                @click="handleCreate"
            >
                {{ handler?.getCreateLabel?.(query) ?? `创建 "${query}"` }}
            </div>
            <div
                v-if="!hasOptions && !(handler?.canCreate && query)"
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
    min-width: 160px;
    max-width: 240px;
    max-height: 200px;
    overflow-y: auto;
    background: var(--nue-primary-color-0);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    box-shadow: var(--nue-secondary-shadow);
    padding: 0.25rem;
    z-index: 99;
}

.popover-header {
    font-size: var(--nue-text-xs);
    color: var(--nue-primary-color-600);
    padding: 0.25rem 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.popover-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--nue-primary-radius);
    cursor: pointer;
    font-size: var(--nue-text-sm);
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
        color: var(--nue-primary-color-900)
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
