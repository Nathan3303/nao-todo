<template>
    <nue-div class="tag-color-selector" gap="12px">
        <nue-tooltip v-for="color in tagColors" :key="color" size="small" :content="color">
            <tag-color-dot
                :color="color"
                :data-selected="selectedColor === color"
                @click="selectedColor = color"
            />
        </nue-tooltip>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TagColorDot from '../color-dot/color-dot.vue'
import type { TagColorSelectorProps, TagColorSelectorEmits } from './types'

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<TagColorSelectorProps>()
const emit = defineEmits<TagColorSelectorEmits>()

const tagColors = [
    '#2196f3',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#00bcd4',
    '#009688',
    '#8bc34a',
    '#cddc39',
    '#ffeb3b',
    '#ffc107',
    '#ff9800',
    '#ff6161',
    '#ff5722',
    '#795548',
    '#9e9e9e',
    '#607d8b'
]

const selectedColor = computed({
    get() {
        const { modelValue } = props
        if (modelValue) return modelValue
        return tagColors[0]
    },
    set(newValue) {
        emit('update:modelValue', newValue as string)
    }
})
</script>

<style scoped>
@import url('./color-selector.css');
</style>
