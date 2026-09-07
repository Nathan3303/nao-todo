<script setup lang="ts">
import type { ScheduleUndoAction } from './reschedule'

/**
 * U2 撤销 action-toast（轻量自建）
 * @description NueMessage 不支持 action 按钮（见 PM 决议 #3），本组件为排期动作的
 *              撤销入口载体：顶部居中胶囊（success/warning 双主题一致，跟随当前主题令牌）、
 *              内含「撤销」动作；自动超时失效由父级（use-calendar-monthly 计时器）控制。
 */
defineOptions({ name: 'CalendarScheduleUndoToast' })

defineProps<{
    action: ScheduleUndoAction
    busy: boolean
}>()
const emit = defineEmits<{ (e: 'undo'): void }>()
</script>

<template>
    <teleport to="body">
        <transition name="utoast">
            <div
                v-if="action"
                class="utoast"
                :class="action.tone === 'warning' ? 'utoast--warning' : 'utoast--success'"
                role="status"
            >
                <span class="utoast__text">{{ action.text }}</span>
                <button type="button" class="utoast__undo" :disabled="busy" @click="emit('undo')">
                    {{ busy ? '撤销中…' : '撤销' }}
                </button>
            </div>
        </transition>
    </teleport>
</template>

<style scoped>
.utoast {
    position: fixed;
    top: var(--nue-gap-df, 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000; /* 高于抽屉 popup-pool(99) 与原生消息(100)，保证任何抽屉之上可见 */
    display: inline-flex;
    align-items: center;
    gap: calc(var(--nue-gap-df, 12px) * 0.6);
    max-width: min(92vw, 720px);
    padding: 0 var(--nue-gap-df, 12px);
    height: var(--nue-box-size-df, 2rem);
    border-radius: var(--nue-primary-radius, 8px);
    border: 1px solid;
    box-sizing: border-box;
    box-shadow: 0 0 0.25rem 1px color-mix(in srgb, var(--utoast-border) 50%, transparent);
    background: var(--utoast-bg);
}

/* success / warning 语义色（与 nue message-node-inner 同令牌，双主题自动一致） */
.utoast--success {
    --utoast-color: var(--nue-success-color-70);
    --utoast-bg: var(--nue-success-color-10);
    --utoast-border: var(--nue-success-color-60);
}

.utoast--warning {
    --utoast-color: var(--nue-warning-color-70);
    --utoast-bg: var(--nue-warning-color-10);
    --utoast-border: var(--nue-warning-color-60);
}

.utoast__text {
    color: var(--utoast-color);
    font-size: var(--nue-text-sm, 0.8125rem);
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.utoast__undo {
    flex: none;
    border: none;
    background: transparent;
    padding: 2px 4px;
    border-radius: calc(var(--nue-primary-radius, 8px) / 2);
    color: var(--utoast-color);
    font-size: var(--nue-text-sm, 0.8125rem);
    font-weight: 600;
    cursor: pointer;
    transition: background 60ms;
}

.utoast__undo:hover:not(:disabled) {
    background: color-mix(in srgb, var(--utoast-border) 22%, transparent);
}

.utoast__undo:disabled {
    opacity: 0.55;
    cursor: default;
}

/* 入场动画（自顶滑入 + 淡入） */
.utoast-enter-active {
    animation: utoast-in 180ms ease-out;
}

@keyframes utoast-in {
    from {
        opacity: 0;
        transform: translate(-50%, -6px);
    }
    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}
</style>