<script setup lang="ts">
import { computed } from 'vue'
import type { PomodoroFocusRingProps } from './types'

const props = withDefaults(defineProps<PomodoroFocusRingProps>(), {
    isRunning: false,
    outerColor: 'var(--nue-primary-color-400)',
    strokeWidth: 6,
    innerColor: 'var(--nue-primary-color-900)',
    scale: 1
})

const trulyStrokeWidth = computed(() => props.strokeWidth * props.scale + 'px')
</script>

<template>
    <svg class="focus-ring" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="focusRingGradient">
                <stop offset="0%" stop-color="var(--nue-primary-color-800)" />
                <stop offset="100%" stop-color="var(--nue-primary-color-200)" />
            </linearGradient>
        </defs>
        <circle
            v-if="isRunning"
            class="circle-path running-path"
            stroke="url(#focusRingGradient)"
        />
        <circle v-else class="circle-path" :stroke="outerColor" />
    </svg>
</template>

<style scoped>
.focus-ring {
    aspect-ratio: 1 / 1;
    width: v-bind('`${scale * 100}px`');
    height: v-bind('`${scale * 100}px`');
    border-radius: 50%;
    user-select: none;
    -webkit-user-select: none;

    .circle-path {
        fill: transparent;
        stroke-width: v-bind('trulyStrokeWidth');
        transform-origin: center;
        scale: 0.9;
        cx: 50%;
        cy: 50%;
        r: 50%;
    }

    .running-path {
        animation: spin-ring 16s linear infinite;
    }
}

@keyframes spin-ring {
    from {
        transform: rotate(0deg);
        scale: 0.9;
    }
    to {
        transform: rotate(360deg);
        scale: 0.9;
    }
}
</style>

