<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import useDropdownExecutor from './use-dropdown-executor'

const { register, unregisterAll, execute } = useDropdownExecutor()

onBeforeUnmount(() => unregisterAll())

defineExpose({ register })

// @state 打开前的焦点持有者（`nue-dropdown` 关闭时**不**归还焦点 ⇒ 本件补这一处，PRD §三·7 / R-E）
let focusOwner: HTMLElement | null = null

// @method 打开时记下当前焦点（正常情况 = 触发器按钮）
const rememberFocus = () => {
    const active = document.activeElement
    focusOwner = active instanceof HTMLElement ? active : null
}

// @method 关闭时归还焦点（目标已从文档移除则不动，避免夺取焦点）
const restoreFocus = () => {
    const target = focusOwner
    focusOwner = null
    if (target?.isConnected) target.focus()
}
</script>

<template>
    <nue-dropdown
        placement="bottom-end"
        size="small"
        @execute="(executeId: string) => execute(executeId)"
        @open="rememberFocus"
        @close="restoreFocus"
        group="tasks-operations-dropdown"
        theme="operations"
    >
        <template #trigger="{ trigger }">
            <slot name="trigger" :trigger="trigger">
                <nue-button icon="more" theme="icon,ghost" @click="trigger" />
            </slot>
        </template>
        <slot></slot>
    </nue-dropdown>
</template>

<style>
.nue-dropdown--operations {
    min-width: 12rem;
}
</style>