<script setup lang="ts">
import CalendarMonthGrid from './month-grid.vue'
import CalendarWeekly from '../weekly/index.vue'
import CalendarDaily from '../daily/index.vue'
import CalendarDayDrawer from './day-drawer.vue'
import UnscheduledDrawer from './unscheduled-drawer.vue'
import ScheduleUndoToast from './undo-toast.vue'
import { ghostPointOf } from './use-drag-schedule'
import { useCalendarHost } from '../use-calendar-host'

defineOptions({ name: 'CalendarStandalone' })

/**
 * 无宿主兜底（单测/独立挂载）
 * @description `monthly/index.vue` 在无 `CALENDAR_MONTHLY_CONTEXT_KEY` 时渲染本组件：
 *              内部自建状态宿主（含内部 `viewMode` 态）并内联渲染三视图 + 共享抽屉/撤销/浮层，
 *              保持 T61 既有断言（内部切视图 + 键盘步长）零改动。
 */
const {
    viewMode,
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
} = useCalendarHost()

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
        <calendar-weekly v-if="viewMode === 'week'" />
        <calendar-daily v-else-if="viewMode === 'day'" />
        <calendar-month-grid v-else />

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