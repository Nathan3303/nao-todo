<template>
    <nue-div class="tag-color-selector" gap="12px">
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
                @click="(selectedColor = color.value)"
            />
        </nue-tooltip>
    </nue-div>
</template>

<script lang="ts" setup>
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
    { value: 'transparent', name: '无颜色' },
    { value: '#FF5733', name: '番茄红 (Tomato Red)' },
    { value: '#D35400', name: '橘棕色 (Tangerine Brown)' },
    { value: '#E74C3C', name: '珊瑚红 (Coral Red)' },
    { value: '#800000', name: '马鞍棕色 (Saddle Brown)' },
    { value: '#640000', name: '巧克力色 (Chocolate)' },
    { value: '#F1C40F', name: '鲜黄色 (Mustard Yellow)' },
    { value: '#32CD32', name: '苜蓿绿 (Lawn Green)' },
    { value: '#2ECC71', name: '鲜绿宝石 (Emerald Green)' },
    { value: '#1ABC9C', name: '强绿松石色 (Robust Turquoise)' },
    { value: '#8FBC8F', name: '老绿色 (Old Lace)' },
    { value: '#3498DB', name: '亮天蓝 (Bright Cerulean)' },
    { value: '#483D8B', name: '深蓝色 (Dark Blue)' },
    { value: '#4B0082', name: '靛蓝色 (Indigo)' },
    { value: '#9B59B6', name: '中紫罗兰色 (Medium Violet-Magenta)' },
    { value: '#8E44AD', name: '深紫罗兰色 (Deep Violet-Magenta)' }
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
}

.tag-color-selector:deep(.tag-color-dot) {
    cursor: pointer;
    position: relative;
}

.tag-color-selector:deep(.tag-color-dot)[data-selected='true']::after {
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

.tag-color-selector:deep(.tag-color-dot.tag-color-dot--transparent)[data-selected='true']::after {
    background-color: rgba(180, 102, 102, 0.4);
}
</style>
