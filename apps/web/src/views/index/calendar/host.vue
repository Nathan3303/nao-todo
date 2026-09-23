<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { assetUrl } from '@nao-todo/shared'
import CalendarDayDrawer from '@/components/calendar/monthly/day-drawer.vue'
import UnscheduledDrawer from '@/components/calendar/monthly/unscheduled-drawer.vue'
import ScheduleUndoToast from '@/components/calendar/monthly/undo-toast.vue'
import { ghostPointOf } from '@/components/calendar/monthly/use-drag-schedule'
import { MAX_VISIBLE_LANES } from '@/components/calendar/monthly/monthly-layout'
import { useCalendarHost } from '@/components/calendar/use-calendar-host'
import { resolveViewSwitch, viewModeOfRouteName, type CalendarViewName } from './view-routes'

import '@/components/calendar/calendar-grid.css'

defineOptions({ name: 'CalendarHost' })

const route = useRoute()
const router = useRouter()

// @computed 视图态只读派生自 route.name（C5：无可变镜像；导航是唯一写路径）
const viewMode = computed(() => viewModeOfRouteName(route.name))

// @method 切视图 = router.replace（C10：幂等短路 + taskId/query 原样透传）
const switchView = (name: CalendarViewName): void => {
    const target = resolveViewSwitch(router, route, name)
    if (!target) return
    void router.replace(target)
}

// @states 月视图网格实测轨道数（宿主唯一，月视图写回；`model` 依赖）
const laneLimit = ref<number>(MAX_VISIBLE_LANES)

const {
    drag,
    activeUndo,
    dayDrawerDate,
    dayDrawerOpen,
    dayTasks,
    unscheduledOpen,
    toggleDone,
    deferToToday,
    openTaskFromPanel,
    createTaskOnDay,
    showWeekOf,
    unscheduledTasks,
    filterActive,
    hideCompleted,
    clearFilter,
    scheduleBusy,
    rescheduleBusyId,
    scheduleToDay,
    runBatchSchedule
} = useCalendarHost({
    laneLimit,
    view: {
        viewMode,
        toMonth: () => switchView('calendar-monthly'),
        toWeek: () => switchView('calendar-weekly'),
        toDay: () => switchView('calendar-day')
    }
})

const showCompleted = () => {
    hideCompleted.value = false
}
const ghostStyle = () => {
    const point = ghostPointOf(drag.session.x, drag.session.y)
    return { left: `${point.x}px`, top: `${point.y}px` }
}
</script>

<template>
    <nue-div vertical class="nue-calendar-host" gap="0">
        <!-- 三视图子路由（宿主不随子路由卸载 ⇒ 任务快照零重拉，C2） -->
        <router-view v-slot="{ Component }">
            <suspense>
                <component :is="Component" />
                <template #pending>
                    <loading-comp height="100%" />
                </template>
                <template #fallback>
                    <nue-empty :image-src="assetUrl('/images/error.webp')" image-size="6rem">
                        <nue-text size="var(--nue-text-sm)"> 加载失败, 请刷新页面重试 </nue-text>
                    </nue-empty>
                </template>
            </suspense>
        </router-view>

        <!-- 当日任务面板 -->
        <calendar-day-drawer
            v-model:open="dayDrawerOpen"
            :date-key="dayDrawerDate"
            :tasks="dayTasks"
            :on-toggle-done="toggleDone"
            :on-defer="deferToToday"
            :on-open-task="openTaskFromPanel"
            :on-create="() => createTaskOnDay(dayDrawerDate)"
            :on-go-week="showWeekOf"
        />

        <!-- 未安排任务抽屉（B7 + F3 多选批量 / U2 撤销接线） -->
        <unscheduled-drawer
            v-model:open="unscheduledOpen"
            :tasks="unscheduledTasks"
            :filter-active="filterActive"
            :hide-completed="hideCompleted"
            :schedule-busy="scheduleBusy"
            :busy-task-id="rescheduleBusyId"
            :on-toggle-done="toggleDone"
            :on-schedule-to-day="scheduleToDay"
            :on-batch-schedule-to-day="runBatchSchedule"
            :on-row-drag-start="(task, event) => drag.startPossible(task, 'row', event)"
            :on-open-task="openTaskFromPanel"
            :on-clear-filter="clearFilter"
            :on-show-completed="showCompleted"
        />

        <!-- C9 撤销 action-toast（全节唯一挂载点；daily 时间轴栈经注入通道上报） -->
        <schedule-undo-toast
            v-if="activeUndo"
            :action="activeUndo.action"
            :busy="activeUndo.busy"
            @undo="activeUndo.undo"
            @dismiss="activeUndo.dismiss"
        />

        <!-- F1 浮空胶囊（拖拽跟随，fixed 非 DOM 克隆） -->
        <teleport to="body">
            <div v-if="drag.session.active" class="drag-ghost" :style="ghostStyle()">
                {{ drag.session.name }}
            </div>
        </teleport>
    </nue-div>
</template>

<style scoped>
/* F1 浮空胶囊（拖拽跟随；fixed 顶层，非 DOM 克隆；teleport body 用全局主题令牌） */
.drag-ghost {
    position: fixed;
    z-index: 1300;
    pointer-events: none;
    max-width: 220px;
    padding: 3px 10px;
    border-radius: 6px;
    background: var(--nue-primary-color-200);
    color: var(--nue-primary-text-color);
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--nue-primary-text-color) 20%, transparent);
    border: 1px solid var(--nue-border-color);
    box-sizing: border-box;
}
</style>