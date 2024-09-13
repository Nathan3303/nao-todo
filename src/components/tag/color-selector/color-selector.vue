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
import { ref, computed } from 'vue'
import TagColorDot from '../color-dot/color-dot.vue'
import type { TagColorSelectorProps, TagColorSelectorEmits } from './types'

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<TagColorSelectorProps>()
const emit = defineEmits<TagColorSelectorEmits>()

const tagColors = ['#ff6161', '#ff9800', '#ffd324', '#4caf50', '#2196f3', '#9c27b0', '#673ab7']

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
