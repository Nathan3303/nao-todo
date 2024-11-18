<template>
    <div class="tag-color-dot" :class="classes" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'TagColorDot' })
const props = defineProps<{
    color: string
    size?: 'small' | 'large'
}>()

const classes = computed(() => {
    const classes = []
    const { size } = props
    if (size) classes.push(`tag-color-dot--${size}`)
    return classes
})
</script>

<style scoped>
.tag-color-dot {
    aspect-ratio: 1;
    width: 16px;
    border-radius: 999px;
    background-color: v-bind(color);

    &.tag-color-dot--small {
        width: 13px;
    }

    &.tag-color-dot--large {
        width: 20px;
    }
}
</style>
