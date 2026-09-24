<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { t } from '@nao-todo/shared/locales'
import { computed, inject, ref } from 'vue'
import TaskBar from '../monthly/task-bar.vue'
import CalendarSortDropdown from '../monthly/calendar-sort-dropdown.vue'
import ScheduleUndoToast from '../monthly/undo-toast.vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { DAY_ZOOM_DEFAULT, dayAxisSpecOf, type DayZoom } from './day-zoom'
import { useCalendarDay } from './use-calendar-day'
import { ALLDAY_REASON_TEXT, useDayModel } from './use-day-model'
import { useDayTickCreate } from './use-day-tick-create'
import { useDayViewport } from './use-day-viewport'
import { useDayDrag } from './use-day-drag'

import '../calendar-grid.css'

/**
 * 日视图（TASK-16/18/19/19B/20）
 * @description 组装点：状态与逻辑全部下沉至同目录 composables（`use-day-*`），
 *              样式下沉至同目录 `index.css`（由本 SFC `<style scoped src>` 引入 ⇒ 作用域等价保留）。
 *              DOM / `data-testid` / `data-*` / 类名 / 结构 / sticky 锚定链逐条不变（AC8）。
 */

defineOptions({ name: 'CalendarDaily' })

// @context 日视图上下文（组装点 provide；独立挂载时自足回退，C14/§5.7）
const {
    loading,
    error,
    onRetry,
    anchorKey,
    todayKey,
    tasks,
    sort,
    isDisplayAside,
    switchDisplayAside,
    onOpenTask,
    onOpenUnscheduled,
    onCreateTaskAt,
    onPrevDay,
    onNextDay,
    onGoToday,
    onGoMonth,
    onGoWeek,
    filterActive,
    hideCompleted,
    onClearFilter,
    onShowCompleted,
    unscheduledCount,
    unscheduledDisabled
} = useCalendarDay()

// —— TASK-19 档位：entry 级偏好（D6；context 字段可选 ⇒ 独立挂载自足 ×1） ——
const viewContext = inject(CALENDAR_VIEW_CONTEXT_KEY, null)
const dayZoom = viewContext?.dayZoom ?? ref<DayZoom>(DAY_ZOOM_DEFAULT)
// @computed 当前轴规格（粒度 / 列数；C1：几何仍必经 segmentStyleInColumns）
const axis = computed(() => dayAxisSpecOf(dayZoom.value))
// @computed 格线档位修饰类（轴 ADR r2：四级嵌套链 60/30/10/5）
const gridLineModifier = computed(() => `day-col-lines--${axis.value.columnMinutes}`)

// @computed 网格模型 / 几何 / 标题 / 空态 / 全天原因（纯派生，不发请求）
const { model, segStyle, title, emptyHint, alldayReasonOf } = useDayModel({
    anchorKey,
    todayKey,
    tasks,
    axis,
    filterActive,
    hideCompleted,
    onClearFilter,
    onShowCompleted
})

// 刻度标签与刻度新建入口（C5）/ 视口（档位·锚定·pan·遮罩·当前时间线）/ 任务条手势与写回（C8·C9·C13）
const { tickTextOf, firstLabelIndex, lastLabelIndex, onCreateAtTick } = useDayTickCreate({
    model,
    onCreateTaskAt
})
const {
    bodyEl,
    scrollEl,
    scrollWidthCss,
    onWheel,
    nowLeft,
    isPanning,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onBodyScroll,
    showStartFade,
    showEndFade
} = useDayViewport({ model, dayZoom, setDayZoom: viewContext?.setDayZoom })
const {
    drag,
    trackEl,
    startMove,
    startResize,
    startResizeStart,
    dragPreview,
    ghostStyle,
    scheduleBusy,
    undoAction,
    undoBusy,
    undoLast,
    dismissUndoAction,
    hasHostUndoSink
} = useDayDrag()
</script>

<template>
    <nue-div vertical class="nue-calendar-daily" gap="0">
        <!-- 日导航 -->
        <nue-div align="center" class="day-header" gap="var(--nue-gap-xs)">
            <nue-div align="center" gap="2px">
                <nue-button
                    :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="switchDisplayAside"
                />
                <nue-button
                    icon="arrow-left"
                    theme="icon,ghost"
                    title="前一天"
                    @click="onPrevDay"
                />
                <button type="button" class="day-title">{{ title }}</button>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="后一天"
                    @click="onNextDay"
                />
            </nue-div>
            <nue-div align="center" gap="var(--nue-gap-xs)">
                <calendar-sort-dropdown v-model="sort" />
                <nue-div class="day-view-toggle" role="group" aria-label="视图切换">
                    <nue-button
                        theme="small,ghost"
                        class="day-view-btn"
                        title="切换月视图"
                        aria-pressed="false"
                        @click="onGoMonth"
                    >
                        月
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="day-view-btn"
                        title="切换周视图"
                        aria-pressed="false"
                        @click="onGoWeek"
                    >
                        周
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="day-view-btn is-active"
                        title="当前：日视图"
                        aria-pressed="true"
                    >
                        日
                    </nue-button>
                </nue-div>
                <span class="day-view-sep" aria-hidden="true"></span>
                <nue-button
                    data-testid="day-unscheduled-entry"
                    theme="ghost,small"
                    :disabled="unscheduledDisabled"
                    title="未安排任务：快速安排到某日"
                    @click="onOpenUnscheduled"
                >
                    未安排 {{ unscheduledCount }}
                </nue-button>
                <nue-button theme="ghost,small" @click="onGoToday">今天</nue-button>
            </nue-div>
        </nue-div>

        <!-- 时间轴（滚动宿主：双轴；D5 落点 daily/index.vue，host.vue 零改动）
             裁切遮罩置于滚动容器之外（C7），仅在对应侧有可滚内容时显示 -->
        <div class="day-body-wrap">
            <div
                ref="bodyEl"
                class="day-body"
                :class="{ 'is-panning': isPanning }"
                @wheel.ctrl.prevent="onWheel"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerCancel"
                @scroll="onBodyScroll"
            >
                <div ref="scrollEl" class="day-scroll" :style="{ width: scrollWidthCss }">
                    <!-- 列头：垂直固定（sticky）、随内容层横向滚动；直接子节点数 = 列数 -->
                    <div
                        class="day-cols-head"
                        data-testid="day-columns"
                        :style="{ gridTemplateColumns: `repeat(${model.columns.length}, 1fr)` }"
                    >
                        <div
                            v-for="col in model.columns"
                            :key="col.index"
                            class="day-col-head"
                            :class="{
                                'is-first-tick': col.index === firstLabelIndex,
                                'is-last-tick': col.index === lastLabelIndex
                            }"
                            :aria-hidden="col.label === '' ? 'true' : undefined"
                        >
                            <!-- 新建入口（C5）：仅带文本刻度可点（原生 button，键盘可达） -->
                            <button
                                v-if="col.label"
                                type="button"
                                class="day-col-label"
                                :aria-label="`在 ${tickTextOf(col.index * axis.columnMinutes)} 创建任务`"
                                :title="`在 ${tickTextOf(col.index * axis.columnMinutes)} 创建任务`"
                                @click="onCreateAtTick(col.index * axis.columnMinutes)"
                            >
                                {{ col.label }}
                            </button>
                        </div>
                    </div>
                    <!-- 全天泳道（时间轴区顶部；与 0–24 同列宽基准、跟随横向滚动；纵向生长由主体滚动承接）
                         只读任务条（C6）：复用 task-bar、无手柄；原因分档由 data-allday-reason 承载 -->
                    <div class="day-allday-lane day-col-lines" :class="gridLineModifier">
                        <div class="day-allday-inner">
                            <span class="day-allday-label">{{ t('calendar.allDay') }}</span>
                            <div class="day-allday-items">
                                <div
                                    v-for="task in model.allDay"
                                    :key="task.id"
                                    class="day-allday-slot"
                                >
                                    <task-bar
                                        class="day-allday-item"
                                        :task="task"
                                        :pos="{ left: '0', width: '100%', top: '0' }"
                                        sticky-label
                                        :title-suffix="ALLDAY_REASON_TEXT[alldayReasonOf(task)]"
                                        :data-allday-reason="alldayReasonOf(task)"
                                        @open="onOpenTask(task.id)"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <nue-divider />
                    <!-- 网格：仅 1 个背景层（禁 列数×N DOM，C6）；格线用 CSS 渐变 -->
                    <div class="day-grid">
                        <div
                            class="day-axis-bg day-col-lines"
                            :class="gridLineModifier"
                            data-testid="day-axis-bg"
                        ></div>
                        <!-- 交互层（覆盖于纯视觉背景之上；day-axis-bg 仍无子节点，C6）
                             仅作几何锚（`pointer-events: none`，禁拦截任务条）；空白平移由 .day-body 承接 -->
                        <div
                            ref="trackEl"
                            class="day-axis-track"
                            data-testid="day-axis-track"
                        ></div>
                        <div class="cal-lanes" role="presentation">
                            <div
                                v-for="seg in model.timed"
                                :key="`${seg.task.id}-${seg.colStart}`"
                                class="day-seg"
                                :style="segStyle(seg)"
                            >
                                <task-bar
                                    data-testid="day-task"
                                    :data-task-id="seg.task.id"
                                    :task="seg.task"
                                    :pos="{ left: '0', width: '100%', top: '0' }"
                                    sticky-label
                                    :show-time="seg.isEnd"
                                    :cont-start="!seg.isStart"
                                    :cont-end="!seg.isEnd"
                                    :dragging="
                                        drag.session.active && drag.session.taskId === seg.task.id
                                    "
                                    @open="onOpenTask(seg.task.id)"
                                    @drag-pointer-down="(e) => startMove(seg.task, e)"
                                />
                                <!-- 两侧手柄恒在（C2 r2）：左拉改 startAt / 右拉改 endAt；续接段也保留 -->
                                <span
                                    class="day-task-resize--start"
                                    @pointerdown.stop="(e) => startResizeStart(seg.task, e)"
                                ></span>
                                <span
                                    class="day-task-resize"
                                    data-testid="day-task-resize"
                                    @pointerdown.stop="(e) => startResize(seg.task, e)"
                                ></span>
                            </div>
                        </div>
                        <!-- 当前时间线（仅今天） -->
                        <div
                            v-if="model.isToday"
                            class="day-now-line"
                            :style="{ left: nowLeft }"
                            aria-hidden="true"
                        ></div>
                        <!-- 拖动中的吸附刻度高亮线（AC2）：松手即移除 -->
                        <div
                            v-if="dragPreview"
                            class="day-drag-snap-line"
                            data-testid="day-drag-snap-line"
                            :style="{ left: dragPreview.snapLeft }"
                            aria-hidden="true"
                        ></div>

                        <!-- 状态覆盖（列头/背景仍渲染，保 DOM 契约稳定） -->
                        <div v-if="loading" class="day-state">
                            <loading-comp height="100%" />
                        </div>
                        <div v-else-if="error" class="day-state">
                            <nue-div vertical align="center" gap="8px">
                                <nue-text size="var(--nue-text-sm)">{{ error }}</nue-text>
                                <nue-button theme="primary,small" @click="onRetry">重试</nue-button>
                            </nue-div>
                        </div>
                        <div v-else-if="emptyHint" class="day-state">
                            <nue-div vertical align="center" gap="8px">
                                <nue-text size="var(--nue-text-sm)">{{ emptyHint.text }}</nue-text>
                                <nue-button
                                    v-if="emptyHint.action"
                                    theme="primary,small"
                                    @click="emptyHint.run"
                                >
                                    {{ emptyHint.action }}
                                </nue-button>
                            </nue-div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 裁切渐隐遮罩（滚动容器之外；C7） -->
            <div class="day-edge-fade is-start" :class="{ 'is-visible': showStartFade }"></div>
            <div class="day-edge-fade is-end" :class="{ 'is-visible': showEndFade }"></div>
        </div>

        <!-- C9 撤销（有宿主时经注入通道上报宿主渲染；无宿主自足回退本地渲染） -->
        <schedule-undo-toast
            v-if="!hasHostUndoSink && undoAction"
            :action="undoAction"
            :busy="undoBusy || scheduleBusy"
            @undo="undoLast"
            @dismiss="dismissUndoAction"
        />

        <!-- F1 浮空胶囊（拖拽跟随）+ 吸附后起止时刻预览（AC2） -->
        <div v-if="drag.session.active" class="drag-ghost" :style="ghostStyle()">
            <span>{{ drag.session.name }}</span>
            <span v-if="dragPreview" class="day-drag-preview" data-testid="day-drag-preview">
                {{ dragPreview.text }}
            </span>
        </div>
    </nue-div>
</template>

<style scoped src="./index.css"></style>