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
import { TagColorDot } from '@nao-todo/components'

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<{
    disabled?: boolean
    modelValue?: string
}>()
const emit = defineEmits<{
    (event: 'update:modelValue', color: string): void
}>()

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
.tag-color-selector {
    width: fit-content;

    &:deep().tag-color-dot {
        cursor: pointer;
        position: relative;
        width: 20px !important;

        &[data-selected='true']::after {
            content: '';
            display: block;
            aspect-ratio: 1;
            width: 12px;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            position: absolute;
            border: 2px solid white;
            border-radius: 50%;
        }
    }
}
</style>
