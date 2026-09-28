<script setup lang="ts">
import { computed } from 'vue'
import { NueButton } from 'nue-ui'

/**
 * U2 撤销扩展区（NueMessage `extension` 内容）
 * @description 库以**独立 `render()` 根**渲染扩展内容（不在本应用作用域内）⇒
 *              ① 组件必须显式 import（本应用全局注册的 `nue-button` 在该根不可见，
 *                 写成字符串标签会退化为未知元素 ⇒ 丢失原生 button 语义/键盘可达）；
 *              ② `busy` 以**取值函数**直传并在此处读取 ⇒ 读取发生在本组件 render 中，
 *                 响应性得以保持（无需依赖库侧的 props 变更）。
 */
const props = defineProps<{
    /** 动作文案（仅用于读屏播报；视觉文案由消息本体承载，避免重复朗读按钮） */
    text: string
    /** 撤销写回中 / 批量写回中（P3-1 互斥）⇒ 按钮禁用并显示「撤销中…」 */
    busy: () => boolean
    undo: () => void
}>()

const isBusy = computed(() => props.busy())
</script>

<template>
    <!-- O8：role=status 收窄到文本（live region 不含交互按钮，按钮不被重复播报） -->
    <span class="undo-entry__live" role="status">{{ text }}</span>
    <nue-button
        theme="pure"
        class="undo-entry__action"
        data-testid="schedule-undo-action"
        :disabled="isBusy"
        @click="undo"
    >
        {{ isBusy ? '撤销中…' : '撤销' }}
    </nue-button>
</template>

<style scoped>
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

.nue-button.undo-entry__action:hover:not(:disabled) {
    background: color-mix(in srgb, var(--nue-message-node-inner-border-color) 22%, transparent);
}

.nue-button.undo-entry__action:disabled {
    opacity: 0.55;
    cursor: default;
}

/* 键盘可达：焦点可见（不另创色板，沿用语义色描边） */
.nue-button.undo-entry__action:focus-visible {
    outline: 2px solid var(--nue-message-node-inner-color);
    outline-offset: 1px;
}
</style>