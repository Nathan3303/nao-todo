<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import TaskBar from '../monthly/task-bar.vue'
import { buildWeekGrid, GRID_COLUMNS, MAX_VISIBLE_LANES } from '../monthly/monthly-layout'
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
}>()

// @viewContext 应用级子侧栏开关（与月视图 header 一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

// —— 周几何常量（与 scoped 样式一致）——
const WEEK_TOP = 34 // 日期区（日期号+周几）高度 + 首条间距
const ITEM_STEP = 18 // 条高 16 + 间距 2

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// @states 动态可视轨道数（DEF-2 语义：行高实测；首帧回退 3）
const laneLimit = ref<number>(MAX_VISIBLE_LANES)
const bodyEl = ref<HTMLElement | null>(null)
let resizeTimer: ReturnType<typeof setTimeout> | undefined
let bodyObserver: ResizeObserver | undefined

// @computed 周模型（锚点=selectedKey 所在周；跨周任务裁剪，复用 buildRowContent）
const model = computed(() => buildWeekGrid(props.selectedKey, props.tasks, laneLimit.value))

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
    const next = Math.max(1, Math.floor((rowHeight - WEEK_TOP - 4) / ITEM_STEP))
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

// @method 溢出 +N 与 点击日期格（打开当日面板）
const overflowOn = (dateKey: string) => model.value.overflow.find((o) => o.dateKey === dateKey)
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
                <nue-text tag="h2" size="var(--nue-text-df)" :weight="600" class="wk-title">
                    {{ title }}
                </nue-text>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="下一周"
                    @click="onNextWeek"
                />
            </nue-div>
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
                    :class="{
                        'wk-cell--outside': cell.monthOffset !== 0,
                        'wk-cell--today': cell.isToday,
                        'wk-cell--selected': cell.isSelected,
                        'wk-cell--weekend': cell.isWeekend,
                        'wk-cell--edge': cell.cell % 7 === 6
                    }"
                    @click="onOpenDay(cell.dateKey)"
                >
                    <span class="wk-date">{{ cell.day }}</span>
                    <button
                        v-if="overflowOn(cell.dateKey)"
                        type="button"
                        class="wk-more"
                        :title="`还有 ${overflowOn(cell.dateKey)!.count} 个任务`"
                        @click.stop="onOpenDay(cell.dateKey)"
                    >
                        +{{ overflowOn(cell.dateKey)!.count }}
                    </button>
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
                        @open="onOpenTask(seg.task.id)"
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
    font-size: var(--nue-text-df);
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
    padding: 4px 2px;
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
    min-width: 24px;
    height: 20px;
    padding: 0 4px;
    font-size: 0.875rem;
    font-weight: 550;
    line-height: 20px;
    color: var(--cal-fg);
    border: 1px solid transparent;
    border-radius: 10px;
    user-select: none;
    box-sizing: border-box;
}
.wk-cell--today .wk-date {
    border-color: var(--cal-fg);
    font-weight: 700;
}
.wk-cell--selected .wk-date {
    background: var(--cal-fg);
    color: var(--cal-bg);
    font-weight: 700;
    border-color: var(--cal-fg);
}
.wk-cell--outside .wk-date {
    color: var(--cal-muted);
}
.wk-cell--weekend:not(.wk-cell--selected) .wk-date {
    opacity: 0.72;
}

/* 任务条层（task-bar 视觉） */
.cal-lanes {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

/* 溢出 +N */
.wk-more {
    position: absolute;
    right: 4px;
    bottom: 4px;
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