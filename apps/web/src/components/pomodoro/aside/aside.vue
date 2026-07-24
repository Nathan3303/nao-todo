<script setup lang="ts">
import { inject, onMounted, ref, watch, nextTick } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
// import { POMODORO_CREATOR_DIALOG_KEY } from '@nao-todo/shared'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'PomodoroAside' })

// @contexts
const {
    isDisplayAside
    // dialogManager
} = inject(POMODORO_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!

//打开新建常用番茄专注对话框
// const handleOpenCreator = () => dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
onMounted(() => setControllOption({ useSlot: false, useDrawerSlot: true }))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="pomodoro-aside">
            <nue-div vertical gap="0.25rem" flex="1">
                <nue-link icon="ntd-fanqie" theme="route" route="/pomodoro/timer">
                    番茄专注
                </nue-link>
                <nue-link icon="ntd-zzt" theme="route" route="/pomodoro/focus">正计时</nue-link>
                <nue-link icon="list" theme="route" route="/pomodoro/pomodoros">常用专注</nue-link>
                <nue-link icon="history" theme="route" route="/pomodoro/records">专注记录</nue-link>
            </nue-div>
            <!-- <nue-div vertical gap="0.25rem" flex="1" justify="end">
                <nue-button icon="plus" @click="handleOpenCreator">新建常用番茄专注</nue-button>
                <nue-button icon="ntd-history">查看历史专注记录</nue-button>
            </nue-div> -->
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--pomodoro-aside {
    flex-direction: column;
    flex: auto;
    height: 100%;
    padding: 1rem;
    overflow: auto;
    gap: var(--nue-gap-lg);
}
</style>
