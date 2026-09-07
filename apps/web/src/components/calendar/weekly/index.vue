<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import QuickCreate from '../monthly/quick-create.vue'
import TaskBar from '../monthly/task-bar.vue'
import MonthJumpPanel from '../monthly/month-jump-panel.vue'
import {
    buildWeekGrid,
    GRID_COLUMNS,
    MAX_VISIBLE_LANES,
    type CalendarWeekStart
} from '../monthly/monthly-layout'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarWeekly' })

const props = defineProps<{
    loading: boolean
    error: string
    onRetry: () => void
    tasks: TaskViewObject[]
    selectedKey: string
    filterActive: boolean
    hideCompleted: boolean
    onClearFilter: () => void
    onShowCompleted: () => void
    onOpenDay: (dateKey: string) => void
    onOpenTask: (taskId: TaskViewObject['id']) => void
    onGoMonth: () => void
    onPrevWeek: () => void
    onNextWeek: () => void
    onGoToday: () => void
    unscheduledCount: number
    unscheduledDisabled: boolean
    onOpenUnscheduled: () => void
    // —— 格内快速新建（B6，由父级共享状态透传） ——
    quickCreateDate: string
    quickPending: boolean
    onQuickOpen: (dateKey: string) => void
    onQuickCancel: () => void
    onQuickSubmit: (dateKey: string, name: string) => void | Promise<boolean>
    /** 周起始口径（C9） */
    weekStart: CalendarWeekStart
    /** 单条改期写回中的任务 ID（F4 逐任务 busy） */
    busyTaskId: string
    /** F4 快速改期：目标日键上抛（父级走 reschedule 内核 + U2 撤销） */
    onRescheduleTask: (task: TaskViewObject, dateKey: string) => void | Promise<void>
    /** F1 拖拽：拖拽会话激活态 / 被拖任务 ID / 当前高亮日期键 / 任务条左键按下（父级接管阈值与会话） */
    dragActive: boolean
    dragTaskId: string
    dragHoverKey: string | null
    onDragBar: (task: TaskViewObject, event: PointerEvent) => void
    /** C2-F9 周视图标题年-月跳转：目标年月上抛（父级落含 1 号的周并选中 1 号，不切回月视图） */
    onJumpYearMonth: (year: number, month: number) => void
}>()

// @viewContext 应用级子侧栏开关（与月视图 header 一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

// —— 周几何常量（与 scoped 样式一致）——
const WEEK_TOP = 26 // 日期区（日期号+周几）高度 + 首条间距
const ITEM_STEP = 18 // 条高 16 + 间距 2
const BAND_HEIGHT = 24 // 格底预留条带（DEF-1：+/+N/编辑器占用，任务条区其上截断）

// @computed 星期表头（随周起始口径）
const weekdays = computed(() =>
    props.weekStart === 'monday'
        ? ['一', '二', '三', '四', '五', '六', '日']
        : ['日', '一', '二', '三', '四', '五', '六']
)

// @states 动态可视轨道数（DEF-2 语义：行高实测；首帧回退 3）
const laneLimit = ref<number>(MAX_VISIBLE_LANES)
const bodyEl = ref<HTMLElement | null>(null)
let resizeTimer: ReturnType<typeof setTimeout> | undefined
let bodyObserver: ResizeObserver | undefined

// @computed 周模型（锚点=selectedKey 所在周；跨周任务裁剪，复用 buildRowContent）
const model = computed(() =>
    buildWeekGrid(props.selectedKey, props.tasks, laneLimit.value, props.weekStart)
)

const visibleSegments = computed(() =>
    model.value.segments.filter((seg) => seg.lane < laneLimit.value)
)

// @computed 周范围标题：同月「9月 · 1日–7日」；跨月「8/31 – 9/6」
const title = computed(() => {
    const first = dayjs(model.value.days[0]?.dateKey)
    const last = dayjs(model.value.days[GRID_COLUMNS - 1]?.dateKey)
    if (!first.isValid() || !last.isValid()) return ''
    if (first.month() === last.month() && first.year() === last.year()) {
        return `${first.month() + 1}月 · ${first.date()}日–${last.date()}日`
    }
    return `${first.month() + 1}/${first.date()} – ${last.month() + 1}/${last.date()}`
})

// @computed 空态：真无 vs 筛选导致（出口与月视图一致）
const weekHasTasks = computed(() => model.value.segments.length > 0)
const emptyHint = computed<{ text: string; action: string; run: () => void } | null>(() => {
    if (weekHasTasks.value) return null
    if (props.filterActive) {
        return { text: '当前筛选条件下本周暂无任务', action: '清除筛选', run: props.onClearFilter }
    }
    if (props.hideCompleted) {
        return { text: '已隐藏已完成任务', action: '显示已完成', run: props.onShowCompleted }
    }
    return null
})

// @method 按行高计算可视条数（同月视图 DEF-2 公式）
const measureAndApplyLaneLimit = () => {
    const row = bodyEl.value?.querySelector<HTMLElement>('.wk-row')
    const rowHeight = row?.clientHeight ?? 0
    if (rowHeight <= 0) return
    const next = Math.max(1, Math.floor((rowHeight - WEEK_TOP - BAND_HEIGHT) / ITEM_STEP))
    if (next !== laneLimit.value) laneLimit.value = next
}
const scheduleLaneMeasure = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(measureAndApplyLaneLimit, 100)
}

// @lifecycle 高度观测（ResizeObserver + 防抖；数据就绪后补量）
onMounted(() => {
    bodyObserver = new ResizeObserver(scheduleLaneMeasure)
    if (bodyEl.value) bodyObserver.observe(bodyEl.value)
    measureAndApplyLaneLimit()
})
onUnmounted(() => {
    bodyObserver?.disconnect()
    bodyObserver = undefined
    clearTimeout(resizeTimer)
})
watch(
    [() => props.loading, () => props.error, () => props.tasks, () => weekHasTasks.value],
    () => {
        void nextTick(measureAndApplyLaneLimit)
    },
    { flush: 'post' }
)

// @method 任务条定位（7 列等分；top 按轨道步进）
const segStyle = (seg: { colStart: number; colEnd: number; lane: number }) => {
    const left = (seg.colStart / GRID_COLUMNS) * 100
    const width = ((seg.colEnd - seg.colStart + 1) / GRID_COLUMNS) * 100
    return {
        left: `${left}%`,
        width: `${width}%`,
        top: `${WEEK_TOP + seg.lane * ITEM_STEP}px`
    }
}

// @method 段首是否显示开始时刻：仅当任务真起始落在本周内可见列
const segShowTime = (seg: { task: TaskViewObject; isStart: boolean; colStart: number }): boolean =>
    !!seg.isStart && !!seg.task.startAt && dayjs(seg.task.startAt).isValid()

// @method 回车提交（dateKey 来自所在格条带）
const quickSubmitCell = (dateKey: string, name: string) => {
    void props.onQuickSubmit(dateKey, name)
}

// @method 溢出 +N 与 点击日期格（打开当日面板）
const overflowOn = (dateKey: string) => model.value.overflow.find((o) => o.dateKey === dateKey)

// —— C2-F9 周视图标题年-月跳转（面板弹层；再点标题 toggle 收起；关闭归还焦点；跳转不切月视图） ——
const wjpOpen = ref(false)
const wjpPos = ref({ x: 0, y: 0 })
const wjpTitleEl = ref<HTMLElement | null>(null)
// 面板锚点年/月 = 当前锚点（选中日）所在年月；非法回退今天
const jumpAnchorYear = computed(() => {
    const anchor = dayjs(props.selectedKey)
    return anchor.isValid() ? anchor.year() : dayjs().year()
})
const jumpAnchorMonth = computed(() => {
    const anchor = dayjs(props.selectedKey)
    return anchor.isValid() ? anchor.month() + 1 : dayjs().month() + 1
})
const closeWeekJump = (): void => {
    wjpOpen.value = false
    void nextTick(() => wjpTitleEl.value?.focus())
}
const toggleWeekJump = (event: MouseEvent): void => {
    if (wjpOpen.value) {
        closeWeekJump()
        return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    wjpPos.value = {
        x: Math.min(Math.max(4, rect.left), window.innerWidth - 248),
        y: Math.min(Math.max(4, rect.bottom + 4), window.innerHeight - 260)
    }
    wjpOpen.value = true
}
const onWeekJumpSelect = (targetYear: number, targetMonth: number): void => {
    props.onJumpYearMonth(targetYear, targetMonth)
    closeWeekJump()
}
</script>

<template>
    <nue-div vertical class="nue-calendar-weekly" gap="0">
        <!-- 周导航 -->
        <nue-div align="center" class="wk-header" gap="8px">
            <nue-div align="center" gap="2px">
                <nue-button
                    :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="switchDisplayAside"
                />
                <nue-button
                    icon="arrow-left"
                    theme="icon,ghost"
                    title="上一周"
                    @click="onPrevWeek"
                />
                <button
                    ref="wjpTitleEl"
                    type="button"
                    class="wk-title"
                    data-mjp-trigger
                    title="跳转到年月"
                    @click="toggleWeekJump"
                >
                    {{ title }}
                </button>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="下一周"
                    @click="onNextWeek"
                />
            </nue-div>
            <!-- 年-月跳转面板（C2-F9；周视图内落周，不切回月视图） -->
            <month-jump-panel
                :open="wjpOpen"
                :x="wjpPos.x"
                :y="wjpPos.y"
                :anchor-year="jumpAnchorYear"
                :anchor-month="jumpAnchorMonth"
                @select="onWeekJumpSelect"
                @close="closeWeekJump"
            />
            <nue-div align="center" gap="6px">
                <nue-div class="wk-view-toggle" role="group" aria-label="视图切换">
                    <nue-button
                        theme="small,ghost"
                        class="wk-view-btn"
                        title="切回月视图"
                        @click="onGoMonth"
                    >
                        月
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="wk-view-btn is-active"
                        title="当前：周视图"
                        @click="onGoMonth"
                    >
                        周
                    </nue-button>
                </nue-div>
                <span class="wk-view-sep" aria-hidden="true"></span>
                <nue-button
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

        <!-- 星期表头 -->
        <nue-div class="wk-weekdays" gap="0">
            <div v-for="day in weekdays" :key="day" class="wk-weekday">{{ day }}</div>
        </nue-div>

        <!-- 周主体（7 列单行 + 任务条层） -->
        <div ref="bodyEl" class="wk-body">
            <div v-if="loading" class="wk-state">
                <loading-comp height="100%" />
            </div>
            <div v-else-if="error" class="wk-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)">{{ error }}</nue-text>
                    <nue-button theme="primary,small" @click="onRetry">重试</nue-button>
                </nue-div>
            </div>
            <div v-else-if="emptyHint" class="wk-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)">{{ emptyHint.text }}</nue-text>
                    <nue-button theme="primary,small" @click="emptyHint.run">
                        {{ emptyHint.action }}
                    </nue-button>
                </nue-div>
            </div>
            <div v-else-if="!weekHasTasks" class="wk-state">
                <nue-text size="var(--nue-text-sm)">本周暂无任务</nue-text>
            </div>
            <!-- 网格 -->
            <div v-else class="wk-row">
                <div
                    v-for="cell in model.days"
                    :key="cell.dateKey"
                    class="wk-cell"
                    :data-cal-drop="cell.dateKey"
                    :class="{
                        'wk-cell--outside': cell.monthOffset !== 0,
                        'wk-cell--today': cell.isToday,
                        'wk-cell--selected': cell.isSelected,
                        'wk-cell--weekend': cell.isWeekend,
                        'wk-cell--edge': cell.cell % 7 === 6,
                        'wk-cell--drop': dragActive && dragHoverKey === cell.dateKey
                    }"
                    @click="onOpenDay(cell.dateKey)"
                >
                    <span class="wk-date">{{ cell.day }}</span>
                    <div class="wk-band" @click.stop>
                        <template v-if="quickCreateDate === cell.dateKey">
                            <quick-create
                                :pending="quickPending"
                                @submit="(name) => quickSubmitCell(cell.dateKey, name)"
                                @cancel="onQuickCancel"
                            />
                        </template>
                        <template v-else>
                            <button
                                type="button"
                                class="wk-quick-add"
                                title="快速新建"
                                @click.stop="onQuickOpen(cell.dateKey)"
                            >
                                +
                            </button>
                            <button
                                v-if="overflowOn(cell.dateKey)"
                                type="button"
                                class="wk-more"
                                :title="`还有 ${overflowOn(cell.dateKey)!.count} 个任务`"
                                @click.stop="onOpenDay(cell.dateKey)"
                            >
                                +{{ overflowOn(cell.dateKey)!.count }}
                            </button>
                        </template>
                    </div>
                </div>
                <!-- 任务条层 -->
                <div class="cal-lanes">
                    <task-bar
                        v-for="seg in visibleSegments"
                        :key="`${seg.task.id}-${seg.colStart}`"
                        :task="seg.task"
                        :pos="segStyle(seg)"
                        :show-time="segShowTime(seg)"
                        :cont-start="!seg.isStart && seg.colStart === 0"
                        :cont-end="!seg.isEnd && seg.colEnd === GRID_COLUMNS - 1"
                        :busy="busyTaskId === seg.task.id"
                        :dragging="dragActive && dragTaskId === seg.task.id"
                        @open="onOpenTask(seg.task.id)"
                        @reschedule="(dateKey) => onRescheduleTask(seg.task, dateKey)"
                        @drag-pointer-down="(event) => onDragBar(seg.task, event)"
                    />
                </div>
            </div>
        </div>
    </nue-div>
</template>

<style scoped>
/* 设计底座令牌（与月历根一致；task-bar 的 --cal-* 消费） */
.nue-calendar-weekly {
    --cal-bg: var(--nue-primary-color-0);
    --cal-fg: var(--nue-primary-text-color);
    --cal-muted: color-mix(in srgb, var(--nue-primary-text-color) 45%, var(--nue-primary-color-0));
    --cal-border: var(--nue-border-color);
    --cal-hover: color-mix(in srgb, var(--nue-primary-text-color) 5%, var(--nue-primary-color-0));
    --cal-select-bg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 9%,
        var(--nue-primary-color-0)
    );
    --cal-chip-bg: color-mix(in srgb, var(--nue-primary-text-color) 6%, var(--nue-primary-color-0));
    --cal-chip-bg-hover: color-mix(
        in srgb,
        var(--nue-primary-text-color) 18%,
        var(--nue-primary-color-0)
    );
    --cal-chip-done-bg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 6%,
        var(--nue-primary-color-0)
    );
    --cal-chip-done-fg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 38%,
        var(--nue-primary-color-0)
    );

    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.wk-header {
    margin-bottom: 1rem;
    user-select: none;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.wk-title {
    min-width: 132px;
    text-align: center;
    letter-spacing: 0.02em;
    margin: 0;
    padding: 2px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--cal-fg);
    font-family: inherit;
    font-size: var(--nue-text-df);
    font-weight: 600;
    line-height: inherit;
    cursor: pointer;
    transition: background 60ms;
}
.wk-title:hover {
    background: var(--cal-hover);
}
.wk-title:focus-visible {
    outline: 1px solid var(--cal-border);
}

/* 月/周视图切换（分段按钮：零间隙贴合） */
.wk-view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--cal-border);
    border-radius: var(--nue-primary-radius);
    overflow: hidden;
}
.wk-view-btn {
    border-radius: 0 !important;
}
.wk-view-btn.is-active {
    background: var(--cal-select-bg);
    color: var(--cal-fg);
    font-weight: 600;
}

/* 切换区与右侧控件之间的垂直分割线 */
.wk-view-sep {
    align-self: center;
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--cal-border);
    flex: none;
}

.wk-weekdays {
    display: flex;
    margin-bottom: 4px;
}
.wk-weekday {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--cal-muted);
    padding: 0.25rem 0;
    letter-spacing: 0.04em;
}

.wk-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--cal-border);
    border-radius: var(--nue-primary-radius);
    overflow: hidden;
    background: var(--cal-bg);
}

.wk-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
}

/* 单行网格：7 列等分 */
.wk-row {
    position: relative;
    flex: 1;
    min-height: 120px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    overflow: hidden;
}

.wk-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 2px 2px;
    background: var(--cal-bg);
    cursor: pointer;
    box-shadow: inset -1px 0 0 var(--cal-border);
    transition: background 50ms;
}
.wk-cell--edge {
    box-shadow: none;
}
.wk-cell:hover {
    background: var(--cal-hover);
    z-index: 0;
}
.wk-cell--outside {
    background: color-mix(in srgb, var(--cal-bg) 92%, var(--cal-border));
}

.wk-date {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 20px;
    font-size: 0.8125rem;
    font-weight: 450;
    line-height: 20px;
    color: var(--cal-fg);
    border: 1px solid transparent;
    border-radius: 10px;
    user-select: none;
    box-sizing: border-box;
}
.wk-cell--today .wk-date {
    border-color: var(--cal-fg);
    font-weight: 600;
}
.wk-cell--selected .wk-date {
    background: var(--cal-fg);
    color: var(--cal-bg);
    font-weight: 600;
    border-color: var(--cal-fg);
}
.wk-cell--outside .wk-date {
    color: var(--cal-muted);
}
.wk-cell--weekend:not(.wk-cell--selected) .wk-date {
    opacity: 0.72;
}

/* F1 drop 目标高亮（周整列格） */
.wk-cell--drop {
    background: color-mix(in srgb, var(--nue-success-color-60) 14%, var(--cal-bg));
    box-shadow: inset 0 0 0 2px var(--nue-success-color-60);
}
.wk-cell--drop .wk-date {
    border-color: var(--nue-success-color-60);
}

/* 任务条层（task-bar 视觉） */
.cal-lanes {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

/* 格底预留条带（DEF-1：任务条渲染区在其上截断；+/+N/编辑器占用区） */
.wk-band {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    box-sizing: border-box;
}
/* 悬停快速新建 +（左下） */
.wk-quick-add {
    flex: none;
    width: 18px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--cal-chip-bg-hover);
    color: var(--cal-fg);
    font-size: 0.9375rem;
    line-height: 16px;
    cursor: pointer;
    opacity: 0;
    transition:
        opacity 60ms,
        background 60ms;
}
.wk-cell:hover .wk-quick-add {
    opacity: 1;
}
.wk-quick-add:hover {
    background: var(--cal-select-bg);
}

/* 溢出 +N（右下） */
.wk-more {
    flex: none;
    margin-left: auto;
    padding: 1px 6px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--cal-muted);
    font-size: 0.6875rem;
    line-height: 1.4;
    cursor: pointer;
    transition: background 60ms;
}
.wk-more:hover {
    background: var(--cal-hover);
    color: var(--cal-fg);
}
</style>