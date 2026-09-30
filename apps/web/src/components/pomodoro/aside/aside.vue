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
// @computed 「今日专注」仅「番茄专注 / 正计时」显示（T455 B）：其余子页隐藏该区块
const isTimerPage = computed(() => route.name === 'pomodoro')
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
            <template v-if="isTimerPage">
                <nue-divider />
                <!-- 今日专注（T455 B）：仅「番茄专注 / 正计时」显示；loader 仍 entry 级常驻（C1 修后数据正确） -->
                <nue-div class="today-section" flex="1">
                    <pomodoro-record-list
                        compact
                        :records="todayRecords"
                        :loading="recordLoading"
                        :disabled-next-page="recordIsDone"
                        @next-page="handleNextPage"
                    />
                </nue-div>
            </template>
            <!-- <nue-div vertical gap="0.25rem" flex="none" justify="end">
                <nue-button icon="plus" theme="ghost" @click="handleOpenCreator">
                    新建常用番茄专注
                </nue-button>
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

    /* 今日专注区块：占满剩余高度并允许内部滚动（列表自身无限滚动） */
    > .today-section {
        width: 100%;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        flex-direction: column;
        align-items: stretch;

        :deep(.nue-collapse--menu) {
            gap: 0;
            /* T456 ③：折叠区占满 today-section，内容列（概览固定 + 列表滚动） */
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        :deep(.nue-collapse-item) {
            border: none;
        }

        /* 展开态：折叠内容填满剩余高度（翻越组件的行内 --height），供列表滚动、概览固定 */
        :deep(.nue-collapse-item[data-collapsed='false']) {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        :deep(.nue-collapse-item[data-collapsed='false'] .nue-collapse-item__content) {
            height: auto !important;
            max-height: none !important;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }

        :deep(.nue-collapse-item[data-collapsed='true'] .nue-collapse-item__content) {
            height: 0 !important;
            overflow: hidden;
        }
    }
}
</style>