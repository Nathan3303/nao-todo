<script setup lang="ts">
import { computed } from 'vue'
import type { PomodoroFocusRingProps } from './types'

const props = withDefaults(defineProps<PomodoroFocusRingProps>(), {
    isRunning: false,
    outerColor: 'var(--nue-primary-color-200)',
    strokeWidth: 6,
    innerColor: 'var(--nue-primary-color-900)',
    scale: 1
})

const trulyStrokeWidth = computed(() => props.strokeWidth * props.scale + 'px')

// @constant 圆周长（半径 50，与 nue-progress circle 一致）
const CIRCUMFERENCE = Math.ceil(2 * Math.PI * 50) // 315

// @computed 是否为进度弧模式（传入 percentage 即启用）
const isProgress = computed(() => props.percentage !== undefined)

// @computed 进度弧 stroke-dashoffset
const dashOffset = computed(() =>
    Math.ceil((1 - Math.min(100, Math.max(0, props.percentage ?? 0)) / 100) * CIRCUMFERENCE)
)
</script>

<template>
    <svg class="focus-ring" viewBox="0 0 100 100">
        <template v-if="isProgress">
            <circle class="circle-path track-path" :stroke="outerColor" />
            <circle class="circle-path progress-path" :stroke="innerColor" />
        </template>
        <template v-else>
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
        </template>
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
        transform-box: view-box;
        transform-origin: center;
        /* 用 transform 而非独立 scale 属性：Firefox 对"独立 scale 属性 × SVG transform 动画"
           组合存在未修复缺陷（Bug 1887423），会导致运行环与静态环缩放不一致（圆环小一圈） */
        transform: scale(0.9);
        cx: 50%;
        cy: 50%;
        r: 50%;
    }

    .running-path {
        animation: spin-ring 16s linear infinite;
    }

    .progress-path {
        stroke-dasharray: v-bind('CIRCUMFERENCE');
        stroke-dashoffset: v-bind('dashOffset');
        stroke-linecap: round;
        transform: scale(0.9) rotate(-90deg);
        transition: stroke-dashoffset 0.24s linear;
    }

    .track-path {
        transform: scale(0.9) rotate(-90deg);
    }
}

@keyframes spin-ring {
    from {
        transform: scale(0.9) rotate(0deg);
    }
    to {
        transform: scale(0.9) rotate(360deg);
    }
}
</style>