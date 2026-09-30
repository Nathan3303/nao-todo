<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { PomodoroRecordList } from '@nao-todo/presentation/pomodoro'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { POMODORO_CREATOR_DIALOG_KEY } from '@nao-todo/shared/constants'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'PomodoroAside' })

// @contexts
const { isDisplayAside, dialogManager, todayRecords, recordLoading, recordIsDone, handleNextPage } =
    inject(POMODORO_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!

// @viewState 今日专注区块（默认展开；不持久化）
const collapseItems = ref<string[]>(['today'])

// @computed 子视图导航目标：携带当前 taskId ⇒ 切换子视图不丢详情参数（T451）
const route = useRoute()
const currentTaskId = computed(() => route.params.taskId as string | undefined)
const navRoutes = computed(() => ({
    timer: { name: 'pomodoro', params: { type: 'timer', taskId: currentTaskId.value } },
    focus: { name: 'pomodoro', params: { type: 'focus', taskId: currentTaskId.value } },
    collection: { name: 'pomodoro-collection', params: { taskId: currentTaskId.value } },
    records: { name: 'pomodoro-records', params: { taskId: currentTaskId.value } }
}))

//打开新建常用番茄专注对话框
const handleOpenCreator = () => dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="pomodoro-aside">
            <nue-div vertical gap="0.25rem" flex="none">
                <nue-link icon="ntd-fanqie" theme="route" :route="navRoutes.timer">
                    番茄专注
                </nue-link>
                <nue-link icon="ntd-zzt" theme="route" :route="navRoutes.focus">正计时</nue-link>
                <nue-link icon="list" theme="route" :route="navRoutes.collection">
                    常用专注
                </nue-link>
                <nue-link icon="history" theme="route" :route="navRoutes.records"
                    >专注记录</nue-link
                >
            </nue-div>
            <!-- 今日专注（T451）：页面级侧栏常驻，四个子视图共享 -->
            <nue-div class="today-section" flex="1">
                <nue-collapse v-model="collapseItems" theme="menu">
                    <nue-collapse-item name="today" title="今日专注">
                        <pomodoro-record-list
                            hide-header
                            :records="todayRecords"
                            :loading="recordLoading"
                            :disabled-next-page="recordIsDone"
                            @next-page="handleNextPage"
                        />
                    </nue-collapse-item>
                </nue-collapse>
            </nue-div>
            <nue-div vertical gap="0.25rem" flex="none" justify="end">
                <nue-button icon="plus" theme="ghost" @click="handleOpenCreator">
                    新建常用番茄专注
                </nue-button>
                <!-- <nue-button icon="ntd-history">查看历史专注记录</nue-button> -->
            </nue-div>
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

    /* 今日专注区块：占满剩余高度并允许内部滚动（列表自身无限滚动） */
    > .today-section {
        flex: 1;
        min-height: 0;
        overflow: hidden;

        :deep(.nue-collapse--menu) {
            gap: 0;
        }

        :deep(.nue-collapse-item) {
            border: none;
        }
    }
}
</style>