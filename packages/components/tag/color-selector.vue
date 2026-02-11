<script lang="ts" setup>
import { computed } from 'vue'
import { TagColorDot } from '@nao-todo/components'

type TagColorSelectorProps = {
    disabled?: boolean
    modelValue?: string
}
type TagColorSelectorEmits = {
    (event: 'update:modelValue', color: string): void
}

defineOptions({ name: 'TagColorSelector' })
const props = defineProps<TagColorSelectorProps>()
const emit = defineEmits<TagColorSelectorEmits>()

const tagColors = [
    { value: 'transparent', name: '无颜色' },
    { value: '#FF5733', name: '番茄红 (Tomato Red)' },
    { value: '#D35400', name: '橘棕色 (Tangerine Brown)' },
    { value: '#E74C3C', name: '珊瑚红 (Coral Red)' },
    { value: '#800000', name: '马鞍棕色 (Saddle Brown)' },
    { value: '#F1C40F', name: '鲜黄色 (Mustard Yellow)' },
    { value: '#32CD32', name: '苜蓿绿 (Lawn Green)' },
    { value: '#2ECC71', name: '鲜绿宝石 (Emerald Green)' },
    { value: '#1ABC9C', name: '强绿松石色 (Robust Turquoise)' },
    { value: '#3498DB', name: '亮天蓝 (Bright Cerulean)' },
    { value: '#483D8B', name: '深蓝色 (Dark Blue)' },
    { value: '#4B0082', name: '靛蓝色 (Indigo)' },
    { value: '#9B59B6', name: '中紫罗兰色 (Medium Violet-Magenta)' },
    { value: '#8E44AD', name: '深紫罗兰色 (Deep Violet-Magenta)' }
]

const selectedColor = computed({
    get: () => props.modelValue || tagColors[0],
    set: (newValue) => emit('update:modelValue', newValue as string)
})
</script>

<template>
    <nue-div vertical overflow="visible">
        <nue-text size="var(--nue-text-sm)">当前颜色：{{ selectedColor }}</nue-text>
        <nue-div class="tag-color-selector" overflow="visible">
            <nue-tooltip
                v-for="color in tagColors"
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

