<script setup lang="ts">
import { Loading as LoadingComp, t } from '@nao-todo/shared'
import { computed, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { translateTaskError, useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { NueMessage } from 'nue-ui'
import TaskBar from '../monthly/task-bar.vue'
import QuickCreate from '../monthly/quick-create.vue'
import CalendarSortDropdown from '../monthly/calendar-sort-dropdown.vue'
import ScheduleUndoToast from '../monthly/undo-toast.vue'
import { useCalendarSchedule } from '../monthly/use-calendar-schedule'
import { useDragSchedule } from '../monthly/use-drag-schedule'
import { segmentStyleInColumns, useCalendarGrid } from '../monthly/use-calendar-grid'
import { snapMinutes } from '../snap'
import { DAY_COLUMNS, buildDayGrid } from './build-day-grid'
import { useCalendarDay } from './use-calendar-day'

/** 单日总分钟数（坐标换算基准） */
const DAY_MINUTES = 1440
/** 交互最小任务时长（分钟；与渲染 MIN_SPAN 同口径，仅交互用） */
const MIN_TASK_MINUTES = 30

import '../calendar-grid.css'

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
    onTaskCreated,
    onOpenUnscheduled,
    onOpenDay,
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

// —— 复用既有行高实测（C5：禁第二套） ——
const bodyEl = ref<HTMLElement | null>(null)
const { laneLimit } = useCalendarGrid({ containerEl: bodyEl, rowSelector: '.day-grid' })

// —— T51 交互：快速新建 / 拖拽改时间 / 拉伸改时长 / 撤销（C7–C10 / C13） ——
// 写回复用 useCalendarSchedule 内核 + U2 撤销栈（C9）；拖拽复用 useDragSchedule 手势壳（C8）
const interactionTaskUseCase = useTaskUseCase(useTasksStore())
const {
    rescheduleBusyId,
    scheduleBusy,
    undoAction,
    undoBusy,
    undoLast,
    dismissUndoAction,
    applyTimePatch
} = useCalendarSchedule({ taskUseCase: interactionTaskUseCase })

// @states 交互层容器与当前手势（move=拖拽改时间 / resize=拉伸改时长）
const trackEl = ref<HTMLElement | null>(null)
const gesture = ref<'move' | 'resize' | null>(null)

// @method 坐标基准：day-axis-track 的 rect（指针绝对位置换算；禁 offsetX）
const trackRect = (): DOMRect | null => trackEl.value?.getBoundingClientRect() ?? null
const pxPerMinute = (rect: DOMRect): number => rect.width / DAY_MINUTES

const drag = useDragSchedule({
    isBusy: () => rescheduleBusyId.value !== '' || scheduleBusy.value || undoBusy.value,
    closeUnscheduled: () => {},
    scheduleOne: () => {},
    // 日视图像素级落点（C8）：复用同一手势壳；round、时长不变、拉伸只改 endAt（C13 真实值锚）
    resolveDrop: async ({ task, clientX, originX }) => {
        const rect = trackRect()
        const mode = gesture.value
        gesture.value = null
        if (!rect || rect.width <= 0 || !task.startAt) return
        const perMin = pxPerMinute(rect)
        const realStart = dayjs(task.startAt)
        if (mode === 'resize') {
            const startMin = realStart.hour() * 60 + realStart.minute()
            const endMin = Math.max(
                snapMinutes((clientX - rect.left) / perMin, 30, 'round'),
                startMin + MIN_TASK_MINUTES
            )
            // 拉伸只改 endAt；同时回传原 startAt 以便调用方校验 endAt≥startAt 不变量（值不变）
            await applyTimePatch(
                task,
                {
                    startAt: realStart.toISOString(),
                    endAt: realStart.startOf('day').add(endMin, 'minute').toISOString()
                },
                '已调整时长'
            )
        } else {
            const originMin = realStart.hour() * 60 + realStart.minute()
            const newStartMin = snapMinutes(originMin + (clientX - originX) / perMin, 30, 'round')
            const durationMs = dayjs(task.endAt).valueOf() - realStart.valueOf()
            const newStart = realStart.startOf('day').add(newStartMin, 'minute')
            const newEnd = newStart.add(durationMs, 'ms')
            await applyTimePatch(
                task,
                { startAt: newStart.toISOString(), endAt: newEnd.toISOString() },
                '已调整时间'
            )
        }
    }
})

// @method 起拖（任务条主体）
const startMove = (task: TaskViewObject, event: PointerEvent): void => {
    gesture.value = 'move'
    drag.startPossible(task, 'bar', event)
}
// @method 起拉（右缘把手）
const startResize = (task: TaskViewObject, event: PointerEvent): void => {
    gesture.value = 'resize'
    drag.startPossible(task, 'bar', event)
}

// @states 内联快速新建（B6/D5）：点击时刻的 floor 分钟；null = 未打开
const quickCreate = ref<{ startMin: number } | null>(null)
const quickCreatePending = ref(false)

const openQuickCreateAt = (startMin: number): void => {
    quickCreate.value = { startMin }
}
const closeQuickCreate = (): void => {
    if (!quickCreatePending.value) quickCreate.value = null
}
// @method 提交命名：floor 时刻 + 30 分钟时长；失败保留编辑器（可重试），成功关闭并广播（B6 语义）
const submitQuickCreate = async (name: string): Promise<void> => {
    const target = quickCreate.value
    if (!target) return
    quickCreatePending.value = true
    try {
        const base = dayjs(anchorKey.value).startOf('day')
        const [task, err] = await interactionTaskUseCase.create({
            projectId: '',
            name,
            description: '',
            state: 'todo',
            priority: 'low',
            startAt: base.add(target.startMin, 'minute').toISOString(),
            endAt: base.add(target.startMin + MIN_TASK_MINUTES, 'minute').toISOString(),
            tags: [],
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        if (err !== null) {
            NueMessage.error(translateTaskError(err))
            return
        }
        if (task) onTaskCreated(task.id)
        quickCreate.value = null
    } finally {
        quickCreatePending.value = false
    }
}

// @method 点空白：挂载内联命名编辑器（D5；floor 到 30 分钟，提交时才 create）
const onTrackClick = (event: MouseEvent): void => {
    const rect = trackRect()
    if (!rect || rect.width <= 0) return
    const startMin = snapMinutes((event.clientX - rect.left) / pxPerMinute(rect), 30, 'floor')
    openQuickCreateAt(startMin)
}

// @computed 日视图模型（分钟级连续定位；轨道 + 日级 +N 走唯一 packLanes）
const model = computed(() =>
    buildDayGrid(anchorKey.value || todayKey, tasks.value, laneLimit.value, todayKey)
)

// @computed 可视轨道内的任务条（超出以 +N 折叠）
const visibleTimed = computed(() => model.value.timed.filter((seg) => seg.lane < laneLimit.value))

// @computed 日级溢出计数（单探针 → 长度 0/1）
const overflowCount = computed(() => model.value.overflow[0]?.count ?? 0)

// @method 任务条定位（日视图 48 列；唯一几何实现 segmentStyleInColumns，C1）
const segStyle = (seg: { colStart: number; colEnd: number; lane: number }) =>
    segmentStyleInColumns(seg, DAY_COLUMNS, 0)

// @computed 标题（锚点日）
const title = computed(() => {
    const anchor = dayjs(anchorKey.value)
    return anchor.isValid() ? anchor.format('YYYY 年 M 月 D 日') : ''
})

// @computed 空态文案（区分筛选/隐藏完成/真无）
const emptyHint = computed(() => {
    if (overflowCount.value > 0) return null
    if (model.value.timed.length > 0 || model.value.allDay.length > 0) return null
    if (filterActive.value)
        return { text: '当前筛选条件下，当日暂无任务', action: '清除筛选', run: onClearFilter }
    if (hideCompleted.value)
        return { text: '已隐藏已完成任务', action: '显示已完成', run: onShowCompleted }
    return { text: t('calendar.noTasksToday'), action: '', run: () => {} }
})

// —— 当前时间线（仅锚点日=今天；30 秒更新；非今天不挂载定时器） ——
const now = ref(dayjs())
let timer: ReturnType<typeof setInterval> | undefined
watch(
    () => model.value.isToday,
    (isToday) => {
        clearInterval(timer)
        timer = undefined
        if (isToday) {
            now.value = dayjs()
            timer = setInterval(() => (now.value = dayjs()), 30000)
        }
    },
    { immediate: true }
)
onUnmounted(() => clearInterval(timer))
const nowLeft = computed(() => {
    const minutes = now.value.hour() * 60 + now.value.minute()
    return `${(minutes / 1440) * 100}%`
})
</script>

<template>
    <nue-div vertical class="nue-calendar-daily" gap="0">
        <!-- 日导航 -->
        <nue-div align="center" class="day-header" gap="8px">
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
                <nue-divider vertical aria-hidden="true" />
                <nue-div gap="var(--nue-gap-2xs)">
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
        </nue-div>

        <!-- 全天行（仅 endAt ∪ 裁剪后覆盖整天；§5.3） -->
        <div class="day-allday">
            <span class="day-allday-label">{{ t('calendar.allDay') }}</span>
            <div class="day-allday-items">
                <button
                    v-for="task in model.allDay"
                    :key="task.id"
                    type="button"
                    class="day-allday-chip"
                    :title="task.name"
                    @click="onOpenTask(task.id)"
                >
                    {{ task.name }}
                </button>
            </div>
        </div>

        <!-- 时间轴 -->
        <div ref="bodyEl" class="day-body">
            <!-- 列头：48 个直接子节点，整点有文本 -->
            <div class="day-cols-head" data-testid="day-columns">
                <div v-for="col in model.columns" :key="col.index" class="day-col-head">
                    {{ col.label }}
                </div>
            </div>
            <!-- 网格：仅 1 个背景层（禁 48×N DOM，C6）；格线用 CSS 渐变 -->
            <div class="day-grid">
                <div class="day-axis-bg" data-testid="day-axis-bg"></div>
                <!-- 交互层（覆盖于纯视觉背景之上；day-axis-bg 仍无子节点，C6） -->
                <div
                    ref="trackEl"
                    class="day-axis-track"
                    data-testid="day-axis-track"
                    @click="onTrackClick"
                ></div>
                <!-- 内联命名编辑器（复用 quick-create；D5） -->
                <div
                    v-if="quickCreate"
                    class="day-quick-create"
                    data-testid="day-quick-create"
                    :style="{ left: `${(quickCreate.startMin / DAY_MINUTES) * 100}%` }"
                >
                    <quick-create
                        input-testid="day-quick-create-input"
                        :pending="quickCreatePending"
                        @submit="submitQuickCreate"
                        @cancel="closeQuickCreate"
                    />
                </div>
                <div class="cal-lanes" role="presentation">
                    <div
                        v-for="seg in visibleTimed"
                        :key="`${seg.task.id}-${seg.colStart}`"
                        class="day-seg"
                        :style="segStyle(seg)"
                    >
                        <task-bar
                            data-testid="day-task"
                            :data-task-id="seg.task.id"
                            :task="seg.task"
                            :pos="{ left: '0', width: '100%', top: '0' }"
                            :show-time="seg.isEnd"
                            :cont-start="!seg.isStart"
                            :cont-end="!seg.isEnd"
                            :dragging="drag.session.active && drag.session.taskId === seg.task.id"
                            @open="onOpenTask(seg.task.id)"
                            @drag-pointer-down="(e) => startMove(seg.task, e)"
                        />
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
                <!-- 日级 +N（单探针，A6/D3） -->
                <button
                    v-if="overflowCount > 0"
                    type="button"
                    class="day-more"
                    :title="`还有 ${overflowCount} 个任务`"
                    @click="onOpenDay(anchorKey)"
                >
                    +{{ overflowCount }}
                </button>

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

        <!-- U2 撤销（复用共享撤销条，additive testid） -->
        <schedule-undo-toast
            v-if="undoAction"
            :action="undoAction"
            :busy="undoBusy || scheduleBusy"
            @undo="undoLast"
            @dismiss="dismissUndoAction"
        />
    </nue-div>
</template>

<style scoped>
.nue-calendar-daily {
    height: 100%;
    background: var(--cal-bg);
    overflow: hidden;
}

.day-allday {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    border-bottom: 1px solid var(--cal-border);
    padding: 0 4px 4px;
}

.day-allday-label {
    flex: none;
    font-size: 0.75rem;
    color: var(--cal-muted);
}

.day-allday-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
}

.day-allday-chip {
    max-width: 220px;
    padding: 1px 8px;
    border: 1px solid var(--cal-border);
    border-radius: 4px;
    background: var(--cal-chip-bg);
    color: var(--cal-fg);
    font-size: 0.75rem;
    line-height: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
}

.day-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.day-cols-head {
    display: grid;
    grid-template-columns: repeat(48, 1fr);
    flex: none;
}

.day-col-head {
    font-size: 0.65rem;
    color: var(--cal-muted);
    text-align: left;
    padding-left: 2px;
    white-space: nowrap;
    overflow: visible;
}

.day-grid {
    position: relative;
    flex: 1;
    min-height: 0;
}

/* 交互层：点击空白快速新建（覆盖在背景层之上；不破坏 day-axis-bg 无子节点，C6） */
.day-axis-track {
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: pointer;
}

.day-seg {
    position: absolute;
    height: 20px;
    pointer-events: auto;
}

.day-quick-create {
    position: absolute;
    top: 2px;
    z-index: 4;
    width: 160px;
}

.day-task-resize {
    position: absolute;
    top: 0;
    right: -3px;
    width: 8px;
    height: 20px;
    z-index: 3;
    cursor: ew-resize;
    pointer-events: auto;
}

/* 背景层：格线用 CSS 渐变绘制（禁 48×N DOM，C6） */
.day-axis-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image:
        repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(100% / 24 - 1px),
            var(--cal-border) calc(100% / 24 - 1px),
            var(--cal-border) calc(100% / 24)
        ),
        repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(100% / 48 - 1px),
            color-mix(in srgb, var(--cal-border) 55%, transparent) calc(100% / 48 - 1px),
            color-mix(in srgb, var(--cal-border) 55%, transparent) calc(100% / 48)
        );
}

.day-now-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--nue-error-color-60);
    pointer-events: none;
}

.day-now-line::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--nue-error-color-60);
}

.day-more {
    position: absolute;
    right: 4px;
    bottom: 4px;
    z-index: 2;
    padding: 1px 8px;
    border: 1px solid var(--cal-border);
    border-radius: 4px;
    background: var(--cal-chip-bg);
    color: var(--cal-fg);
    font-size: 0.7rem;
    cursor: pointer;
}

.day-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--cal-bg) 82%, transparent);
}
</style>