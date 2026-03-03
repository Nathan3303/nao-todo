<script lang="ts" setup>
import { computed } from 'vue'
import { TagColorDot } from '../tag-color-dot'
import { SelectableTagColors } from './constants'
import type { TagColorSelectorProps, TagColorSelectorEmits } from './types'

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<TagColorSelectorProps>()
const emit = defineEmits<TagColorSelectorEmits>()

const selectedColor = computed({
    get: () => props.modelValue || SelectableTagColors[0]?.name,
    set: (newValue) => emit('update:modelValue', newValue as string)
})
</script>

<template>
    <nue-div vertical overflow="visible">
        <!-- <nue-text size="var(--nue-text-sm)">当前颜色：{{ selectedColor }}</nue-text> -->
        <nue-div class="tag-color-selector" overflow="visible">
            <nue-tooltip
                v-for="color in SelectableTagColors"
                :key="color.value"
                :content="color.name"
                size="small"
            >
                <tag-color-dot
                    :color="color.value"
                    :data-selected="selectedColor === color.value"
                    size="xlarge"
                    @click="selectedColor = color.value"
                />
            </nue-tooltip>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.tag-color-selector {
    gap: 0.5rem;

    &:deep(.tag-color-dot) {
        cursor: pointer;
    }

    &:deep(.tag-color-dot)[data-selected='true']::after {
        box-sizing: border-box;
        content: '';
        display: block;
        aspect-ratio: 1;
        width: 1rem;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        position: absolute;
        border: 2px solid var(--nue-primary-color-900);
        border-radius: 50%;
        box-shadow: 0 0 2px 1px var(--nue-primary-color-900);
    }

    &:deep(.tag-color-dot.tag-color-dot--transparent) {
        background-color: var(--nue-primary-color-200);
    }
}
</style>
