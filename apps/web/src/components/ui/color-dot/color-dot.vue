<template>
    <div :class="classes" :style="styles" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NaoColorDotProps } from './types'
import './color-dot.css'

defineOptions({ name: 'NaoColorDot' })
const props = defineProps<NaoColorDotProps>()

const classes = computed(() => {
    const prefix = 'nao-color-dot'
    return [
        prefix,
        props.size && `${prefix}--${props.size}`,
        props.color === 'transparent' && `${prefix}--transparent`
    ]
})

const styles = computed(() => {
    return {
        '--nao-color-dot-background-color': props.color
    }
})
</script>
