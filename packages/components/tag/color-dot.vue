<script setup lang="ts">
import { computed } from 'vue'

type ColorDotProps = {
    color: string
    size?: 'small' | 'large' | 'xlarge'
}

defineOptions({ name: 'TagColorDot' })
const props = defineProps<ColorDotProps>()

const classes = computed(() => [
    'tag-color-dot',
    props.size && `tag-color-dot--${props.size}`,
    props.color === 'transparent' && 'tag-color-dot--transparent'
])
</script>

<template>
    <div :class="classes" />
</template>

<style scoped>
.tag-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background-color: v-bind(color);
    position: relative;
    box-sizing: border-box;
    flex: none;

    &.tag-color-dot--small {
        width: 10px;
        height: 10px;
    }

    &.tag-color-dot--large {
        width: 14px;
        height: 14px;
    }

    &.tag-color-dot--xlarge {
        width: 16px;
        height: 16px;
    }

    .tag-color-dot--transparent {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px dotted #696969;

        &::before {
            content: '';
            display: block;
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            border-radius: 99px;
        }
    }
}
</style>

