<script setup lang="ts">
import { computed } from 'vue'
import { NueButton } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { ScheduleUndoStatus } from './undo-message'

/**
 * U2 撤销扩展区（NueMessage `extension` 内容；T364 增加成功 / 失败终态）
 * @description 库以**独立 `render()` 根**渲染扩展内容（不在本应用作用域内）⇒
 *              ① 组件必须显式 import `NueButton`（本应用全局注册的 `nue-button` 在该根不可见，
 *                 写成字符串标签会退化为未知元素 ⇒ 丢失原生 button 语义/键盘可达）；
 *              ② `text` / `status` 以**取值函数**直传并在此处读取 ⇒ 读取发生在本组件 render 中，
 *                 响应性得以保持（库 `message` 为静态 prop 无法更新，故主文案也由本组件渲染）。
 *
 *              T364 状态驱动（idle → busy → undone / failed）：
 *              - idle：可点，主文案 = 动作文案，按钮「撤销」
 *              - busy：不可点，按钮「撤销中…」
 *              - undone：**终态**，不可点，主文案「已撤销该调整」、按钮「已撤销」
 *              - failed：仍可点（重试），主文案「撤销失败，可重试」、按钮「重试」
 *
 *              禁用语义用 `aria-disabled` 而非原生 `disabled`：原生 disabled 会在按钮**当前持有焦点**
 *              时把焦点抛回 `<body>`（键盘用户丢失位置）；`aria-disabled` 保留可聚焦性并向辅助技术
 *              声明不可用，真正的「不可再激活」由 `undoLast` 的状态守卫保证（点击为 no-op）。
 */
const props = defineProps<{
    /** 动作文案（idle 主文案；终态文案由 status 覆盖） */
    text: string
    /** 状态机取值函数（idle / busy / undone / failed） */
    status: () => ScheduleUndoStatus
    /** 已被新消息替换（正在淡出）——旧入口不得再触发撤销（T368） */
    retired: () => boolean
    undo: () => void
}>()

const status = computed(() => props.status())
const retired = computed(() => props.retired())
/** 不可点：写回中 / 已成功撤销（终态）/ 已被新消息替换（淡出中）；失败态保持可点以便重试 */
const isInactive = computed(
    () => retired.value || status.value === 'busy' || status.value === 'undone'
)
const message = computed(() => {
    if (status.value === 'undone') return t('calendar.undo.doneMessage')
    if (status.value === 'failed') return t('calendar.undo.failedMessage')
    return props.text
})
const actionLabel = computed(() => {
    if (status.value === 'busy') return t('calendar.undo.busy')
    if (status.value === 'undone') return t('calendar.undo.done')
    if (status.value === 'failed') return t('calendar.undo.retry')
    return t('calendar.undo.action')
})
/** 不可点时不派发（`aria-disabled` 只声明语义，不阻断事件；数据层 `undoLast` 另有状态守卫兜底） */
const onAction = (): void => {
    if (isInactive.value) return
    props.undo()
}
</script>

<template>
    <!-- `undo-entry--failed`：把库消息本体的语义变量改指 error 令牌（颜色与失败文案一致，见 style） -->
    <span class="undo-entry" :class="{ 'undo-entry--failed': status === 'failed' }">
        <!-- O8：role=status 收窄到文本（live region 不含交互按钮，按钮不被重复播报） -->
        <span class="undo-entry__live" role="status">{{ message }}</span>
        <span class="undo-entry__text">{{ message }}</span>
        <nue-button
            theme="pure"
            class="undo-entry__action"
            data-testid="schedule-undo-action"
            :aria-disabled="isInactive"
            @click="onAction"
        >
            {{ actionLabel }}
        </nue-button>
    </span>
</template>

<style scoped>
/* 主文案改由本组件渲染（库 `message` 传空串，见 undo-message.ts）⇒
   去掉库扩展区默认的左分隔线与内边距，避免出现悬空竖线
   （本仓库仅此一处使用 message extension） */
:global(.nue-message-node-inner__extension:has(.undo-entry)) {
    border-left: none;
    padding-left: 0;
}

/* 失败态语义配色（T368）：pill 仍以 `--success`/`--warning` 创建（库 type 创建时固定、无法切换）
   ⇒ 仅改指 error 令牌，使「颜色 = 失败」与文案一致；不改主题包、不写死色值。
   取值与 theme 0.13.27 的 `--error` 映射同源（`-90` 文字 / `-10` 底 / `-80` 边框）；
   实测对比度（error-90 on error-10）：浅色 6.76:1 / 深色 6.51:1 ⇒ 达 WCAG AA */
:global(.nue-message-node-inner:has(.undo-entry--failed)) {
    --nue-message-node-inner-color: var(--nue-error-color-90);
    --nue-message-node-inner-background-color: var(--nue-error-color-10);
    --nue-message-node-inner-border-color: var(--nue-error-color-80);
}

.undo-entry {
    display: inline-flex;
    gap: calc(var(--nue-message-node-inner-vgap) * 0.5);
    align-items: center;
}

/* 主文案：随状态更新（动作文案 / 已撤销该调整 / 撤销失败，可重试） */
.undo-entry__text {
    color: var(--nue-message-node-inner-color);
    font-size: var(--nue-message-node-inner-font-size);
}

/* 读屏活动区域：视觉隐藏（WCAG sr-only，非 display:none / hidden）；脱离 flex 布局 */
.undo-entry__live {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    white-space: nowrap;
    border: 0;
    clip-path: inset(50%);
}

/* 撤销动作：取消息本体的语义色（success/warning 由主题类型类下发），
   双主题自动一致；选择器带上 .nue-button 以提高优先级覆盖 pure 主题默认色 */
.nue-button.undo-entry__action {
    --nue-button-color: var(--nue-message-node-inner-color);
    --nue-button-hover-color: var(--nue-message-node-inner-color);
    flex: none;
    padding: 2px 4px;
    border-radius: calc(var(--nue-primary-radius) / 2);
    color: var(--nue-message-node-inner-color);
    font-size: var(--nue-text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 60ms;
}

.nue-button.undo-entry__action:hover:not([aria-disabled='true']) {
    background: color-mix(in srgb, var(--nue-message-node-inner-border-color) 22%, transparent);
}

/* 不可点（写回中 / 已撤销终态）：视觉弱化且不显示手型；语义由 aria-disabled 声明 */
.nue-button.undo-entry__action[aria-disabled='true'] {
    opacity: 0.55;
    cursor: default;
}

/* 键盘可达：焦点可见（不另创色板，沿用语义色描边） */
.nue-button.undo-entry__action:focus-visible {
    outline: 2px solid var(--nue-message-node-inner-color);
    outline-offset: 1px;
}
</style>