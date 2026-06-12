<script lang="ts" setup>
import { computed } from 'vue'
import { TagColorDot } from '../tag-color-dot'
import { SelectableTagColors } from './constants'
import type { TagColorSelectorProps, TagColorSelectorEmits } from './types'

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<TagColorSelectorProps>()
const emit = defineEmits<TagColorSelectorEmits>()

const selectedColor = computed({
    get: () => props.modelValue || SelectableTagColors[0]?.value || 'transparent',
    set: (newValue) => emit('update:modelValue', newValue as string)
})
</script>

<template>
    <nue-div vertical gap=".5rem">
        <nue-div align="center" gap="0.75rem" class="current-color-display">
            <nue-text size="var(--nue-text-sm)" color="var(--nue-text-color-secondary)">
                当前选择：
            </nue-text>
            <tag-color-dot :color="selectedColor" size="large" />
            <nue-text size="var(--nue-text-sm)">
                {{ SelectableTagColors.find((c) => c.value === selectedColor)?.name || `未知颜色` }}
                {{ selectedColor }}
            </nue-text>
        </nue-div>
        <nue-div class="color-grid" overflow="visible">
            <div
                v-for="color in SelectableTagColors"
                :key="color.value"
                class="color-item"
                :class="{ 'color-item--selected': selectedColor === color.value }"
                :style="{
                    backgroundColor:
                        color.value === 'transparent' ? 'var(--nue-primary-color-100)' : color.value
                }"
                @click="selectedColor = color.value"
            >
                <svg
                    v-if="selectedColor === color.value"
                    class="check-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.color-grid {
    display: grid;
    gap: 1rem;
    padding: var(--nue-padding-xs);
    grid-template-columns: repeat(auto-fit, minmax(1.25rem, 1fr));
    grid-template-rows: repeat(auto-fit, minmax(1.25rem, 1fr));
    width: 20rem;
}

.color-item {
    aspect-ratio: 1;
    height: 1.25rem;
    border-radius: var(--nue-primary-radius);
    cursor: pointer;
    position: relative;
    border: 3px solid transparent;
    box-shadow: var(--nue-secondary-shadow);
    box-sizing: border-box;
}

.color-item:hover {
    transform: scale(1.08);
}

.color-item--selected {
    border-color: var(--nue-primary-color-500);
    box-shadow: 0 0 0 4px rgba(77, 150, 255, 0.25);
}

.color-item--selected:hover {
    transform: scale(1.02);
}

.check-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 1.75rem;
    height: 1.75rem;
    color: var(--nue-primary-color-900);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}
</style>

