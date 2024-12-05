<template>
    <div class="tag-color-dot" :class="classes" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'TagColorDot' })
const props = defineProps<{
    color: string
    size?: 'small' | 'large' | 'xlarge'
}>()

const classes = computed(() => {
    const classes = []
    const { size, color } = props
    if (size) classes.push(`tag-color-dot--${size}`)
    if (color === 'transparent') classes.push('tag-color-dot--transparent')
    return classes
})
</script>

<style scoped>
.tag-color-dot {
    aspect-ratio: 1/1;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background-color: v-bind(color);
    position: relative;
    box-sizing: border-box;
    flex: none;
}

.tag-color-dot.tag-color-dot--small {
    width: 10px;
    height: 10px;
}

.tag-color-dot.tag-color-dot--large {
    width: 18px;
    height: 18px;
}

.tag-color-dot.tag-color-dot--xlarge {
    width: 22px;
    height: 22px;
}

.tag-color-dot--transparent {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dotted #696969;
}

.tag-color-dot--transparent::before {
    content: '';
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    border-radius: 99px;
}
</style>
