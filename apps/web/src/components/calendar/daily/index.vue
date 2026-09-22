<script setup lang="ts">
import { Loading as LoadingComp, t } from '@nao-todo/shared'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { translateTaskError, useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
// 相对路径导入（而非 `@/hooks/use-shortcut`）：桌面端 electron.vite 对 `@/hooks` 做前缀别名
// （→ 桌面装配层 hooks 目录），子路径会解析失败；相对路径指向 webapp 真实文件，两端一致。
import { useShortcut } from '../../../hooks/use-shortcut'
import { NueMessage } from 'nue-ui'
import TaskBar from '../monthly/task-bar.vue'
import QuickCreate from '../monthly/quick-create.vue'
import CalendarSortDropdown from '../monthly/calendar-sort-dropdown.vue'
import ScheduleUndoToast from '../monthly/undo-toast.vue'
import { useCalendarSchedule } from '../monthly/use-calendar-schedule'
import { CALENDAR_UNDO_SINK_KEY } from '../undo-sink'
import { useDragSchedule } from '../monthly/use-drag-schedule'
import { segmentStyleInColumns } from '../monthly/use-calendar-grid'
import { CALENDAR_KEY_SCOPE } from '../monthly/keyboard-nav'
import { DAY_SNAP_MINUTES, snapMinutes } from '../snap'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { buildDayGrid } from './build-day-grid'
import {
    DAY_ZOOM_DEFAULT,
    dayAxisSpecOf,
    dayScrollWidthCss,
    nextDayZoom,
    prevDayZoom,
    type DayZoom
} from './day-zoom'
import { useCalendarDay } from './use-calendar-day'

/** 单日总分钟数（坐标换算基准） */
const DAY_MINUTES = 1440

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

// @states 滚动宿主（.day-body 双轴滚动容器）与横向内容层（.day-scroll）
const bodyEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)

// —— TASK-19 档位：entry 级偏好（D6；context 字段可选 ⇒ 独立挂载自足 ×1） ——
const viewContext = inject(CALENDAR_VIEW_CONTEXT_KEY, null)
const dayZoom = viewContext?.dayZoom ?? ref<DayZoom>(DAY_ZOOM_DEFAULT)
const setDayZoom = viewContext?.setDayZoom
// @computed 当前轴规格（粒度 / 列数；C1：几何仍必经 segmentStyleInColumns）
const axis = computed(() => dayAxisSpecOf(dayZoom.value))

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

// —— C9 撤销呈现唯一：有宿主时经注入通道上报宿主渲染/转发（全节单 toast）；
//        无宿主（单测/独立挂载）走自足回退（本地渲染 toast）⇒ daily-interactions.test.ts 零改动 ——
const undoSink = inject(CALENDAR_UNDO_SINK_KEY, null)
if (undoSink) {
    watch(
        undoAction,
        (action) => {
            if (action) {
                undoSink.report({
                    action,
                    busy: undoBusy,
                    undo: undoLast,
                    dismiss: dismissUndoAction
                })
            } else {
                undoSink.clear()
            }
        },
        { immediate: true }
    )
    onUnmounted(() => undoSink.clear())
}

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
                snapMinutes((clientX - rect.left) / perMin, DAY_SNAP_MINUTES, 'round'),
                startMin + DAY_SNAP_MINUTES
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
            const newStartMin = snapMinutes(
                originMin + (clientX - originX) / perMin,
                DAY_SNAP_MINUTES,
                'round'
            )
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
            endAt: base.add(target.startMin + DAY_SNAP_MINUTES, 'minute').toISOString(),
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
    const startMin = snapMinutes(
        (event.clientX - rect.left) / pxPerMinute(rect),
        DAY_SNAP_MINUTES,
        'floor'
    )
    openQuickCreateAt(startMin)
}

// @computed 日视图模型（分钟级连续定位；轨道 + 日级 +N 走唯一 packLanes）
// D4/V1：maxLanes=Infinity ⇒ overflow 恒空、全部轨道渲染（纵向溢出由主体滚动承接）；
// axis.columnMinutes 为依赖 ⇒ 缩放重算模型（纯派生、不发请求，AC7 安全）
const model = computed(() =>
    buildDayGrid(anchorKey.value || todayKey, tasks.value, Number.POSITIVE_INFINITY, todayKey, {
        columnMinutes: axis.value.columnMinutes
    })
)

// @method 任务条定位（列数 = 模型列数；唯一几何实现 segmentStyleInColumns，C1）
const segStyle = (seg: { colStart: number; colEnd: number; lane: number }) =>
    segmentStyleInColumns(seg, model.value.columns.length, 0)

// @computed 标题（锚点日）
const title = computed(() => {
    const anchor = dayjs(anchorKey.value)
    return anchor.isValid() ? anchor.format('YYYY 年 M 月 D 日') : ''
})

// @computed 空态文案（区分筛选/隐藏完成/真无）
const emptyHint = computed(() => {
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

// —— TASK-19 缩放：三入口（按钮 / 快捷键 / Ctrl+滚轮）+ 视口锚定（ADR §5.3 #11–12） ——
const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

/** 时间轴实宽（`.day-scroll` 内容宽）；未布局（jsdom）→ 0 */
const axisWidth = (): number => scrollEl.value?.getBoundingClientRect().width ?? 0

/** 当前视口中心对应的时间（分钟）；无法计算 → null */
const currentCenterMin = (): number | null => {
    const body = bodyEl.value
    const width = axisWidth()
    const viewport = body?.clientWidth ?? 0
    if (!body || width <= 0 || viewport <= 0) return null
    return ((body.scrollLeft + viewport / 2) / width) * DAY_MINUTES
}

let pendingCenterMin: number | null = null

/** 缩放后把原视口中心写回（禁 smooth，避免与宽度变更竞态） */
const restoreCenter = (): void => {
    const body = bodyEl.value
    const width = axisWidth()
    const viewport = body?.clientWidth ?? 0
    const centerMin = pendingCenterMin
    pendingCenterMin = null
    if (!body || width <= 0 || viewport <= 0 || centerMin === null) return
    body.scrollLeft = clamp((centerMin / DAY_MINUTES) * width - viewport / 2, 0, width - viewport)
}

/** 进入日视图：横向定位到当前时间（非今天 → 00:00；不持久化 scrollLeft） */
const scrollToNow = (): void => {
    const body = bodyEl.value
    const width = axisWidth()
    const viewport = body?.clientWidth ?? 0
    if (!body || width <= 0 || viewport <= 0) return
    if (!model.value.isToday) {
        body.scrollLeft = 0
        return
    }
    const nowMin = now.value.hour() * 60 + now.value.minute()
    body.scrollLeft = clamp((nowMin / DAY_MINUTES) * width - viewport / 2, 0, width - viewport)
}
onMounted(() => {
    void nextTick(scrollToNow)
})

/** 缩放写回（优先走 entry 级 setter 以持久化；无 setter 时直改 ref） */
const applyZoom = (next: DayZoom): void => {
    if (next === dayZoom.value) return
    pendingCenterMin = currentCenterMin()
    if (setDayZoom) setDayZoom(next)
    else dayZoom.value = next
    void nextTick(restoreCenter)
}
const canZoomIn = computed(() => nextDayZoom(dayZoom.value) !== dayZoom.value)
const canZoomOut = computed(() => prevDayZoom(dayZoom.value) !== dayZoom.value)
const zoomIn = (): void => applyZoom(nextDayZoom(dayZoom.value))
const zoomOut = (): void => applyZoom(prevDayZoom(dayZoom.value))
const zoomReset = (): void => applyZoom(DAY_ZOOM_DEFAULT)

// @computed 横向内容层宽度：max(k × 容器宽, 列数 × 20px)（D3）
const scrollWidthCss = computed(() => dayScrollWidthCss(dayZoom.value, model.value.columns.length))

// 入口②：快捷键（keys 字面量已定死；scope=CALENDAR_KEY_SCOPE，随日视图卸载注销）
useShortcut('calendar.dayzoom.in', '$mod+=', () => zoomIn(), { scope: CALENDAR_KEY_SCOPE })
useShortcut('calendar.dayzoom.out', '$mod+-', () => zoomOut(), { scope: CALENDAR_KEY_SCOPE })
useShortcut('calendar.dayzoom.reset', '$mod+0', () => zoomReset(), { scope: CALENDAR_KEY_SCOPE })

// 入口③：Ctrl/⌘ + 滚轮（deltaY < 0 放大、> 0 缩小、=== 0 忽略；preventDefault 由 .prevent 承担）
const onWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) return
    if (event.deltaY < 0) zoomIn()
    else zoomOut()
}
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
                <nue-button
                    data-testid="day-zoom-out"
                    icon="ntd-minus"
                    theme="icon,ghost"
                    aria-label="缩小时间轴"
                    :disabled="canZoomOut ? undefined : true"
                    @click="zoomOut"
                />
                <nue-button
                    data-testid="day-zoom-in"
                    icon="ntd-plus"
                    theme="icon,ghost"
                    aria-label="放大时间轴"
                    :disabled="canZoomIn ? undefined : true"
                    @click="zoomIn"
                />
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

        <!-- 时间轴（滚动宿主：双轴；D5 落点 daily/index.vue，host.vue 零改动） -->
        <div ref="bodyEl" class="day-body" @wheel.ctrl.prevent="onWheel">
            <div ref="scrollEl" class="day-scroll" :style="{ width: scrollWidthCss }">
                <!-- 列头：垂直固定（sticky）、随内容层横向滚动；子节点数 = 列数 -->
                <div
                    class="day-cols-head"
                    data-testid="day-columns"
                    :style="{ gridTemplateColumns: `repeat(${model.columns.length}, 1fr)` }"
                >
                    <div v-for="col in model.columns" :key="col.index" class="day-col-head">
                        {{ col.label }}
                    </div>
                </div>
                <!-- 全天泳道（时间轴区顶部；与 0–24 同列宽基准、跟随横向滚动；纵向生长由主体滚动承接） -->
                <div
                    class="day-allday-lane day-col-lines"
                    :class="{ 'is-fine': axis.columnMinutes < 30 }"
                    :style="{ '--day-col-count': model.columns.length }"
                >
                    <div class="day-allday-inner">
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
                </div>
                <!-- 网格：仅 1 个背景层（禁 48×N DOM，C6）；格线用 CSS 渐变 -->
                <div class="day-grid">
                    <div
                        class="day-axis-bg day-col-lines"
                        :class="{ 'is-fine': axis.columnMinutes < 30 }"
                        data-testid="day-axis-bg"
                        :style="{ '--day-col-count': model.columns.length }"
                    ></div>
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
                                :show-time="seg.isEnd"
                                :cont-start="!seg.isStart"
                                :cont-end="!seg.isEnd"
                                :dragging="
                                    drag.session.active && drag.session.taskId === seg.task.id
                                "
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

        <!-- C9 撤销（有宿主时经注入通道上报宿主渲染；无宿主自足回退本地渲染） -->
        <schedule-undo-toast
            v-if="!undoSink && undoAction"
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

.day-allday-lane {
    flex: none;
    border-bottom: 1px solid var(--cal-border);
}

.day-allday-inner {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
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
    position: relative;
    overflow: auto;
}

/* 横向内容层：宽度 = max(k × 容器宽, 列数 × 20px)（D3；inline style 注入） */
.day-scroll {
    display: flex;
    flex-direction: column;
    min-height: 100%;
}

.day-cols-head {
    display: grid;
    flex: none;
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--cal-bg);
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
    flex: 1 0 auto;
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

/* 背景层：定位层（格线由共享类 .day-col-lines 提供，禁 48×N DOM，C6） */
.day-axis-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

/* 共享格线（背景层与全天泳道同用，单一来源；三级：60min > 30min > sub-30）
   sub-30 仅 columnMinutes < 30 时着色（.is-fine），否则透明 ⇒ 不出现冗余格线 */
.day-col-lines {
    --day-sub-line: transparent;
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
        ),
        repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(100% / var(--day-col-count) - 1px),
            var(--day-sub-line) calc(100% / var(--day-col-count) - 1px),
            var(--day-sub-line) calc(100% / var(--day-col-count))
        );
}

.day-col-lines.is-fine {
    --day-sub-line: color-mix(in srgb, var(--cal-border) 30%, transparent);
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

.day-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--cal-bg) 82%, transparent);
}
</style>