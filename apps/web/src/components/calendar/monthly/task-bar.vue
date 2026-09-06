<script setup lang="ts">
import type { TaskViewObject } from '@nao-todo/domain-task'
import dayjs from 'dayjs'
import { computed } from 'vue'
import { isTaskOverdue } from './use-calendar-monthly'

defineOptions({ name: 'CalendarTaskBar' })

const props = defineProps<{
    task: TaskViewObject
    /** 定位样式（父容器按列区间计算 left/width/top） */
    pos: { left: string; width: string; top: string }
    /** 段首显示开始时刻（父容器仅在真起始可见段置 true） */
    showTime?: boolean
    /** 承接上一行（月视图跨行续接圆点） */
    contStart?: boolean
    /** 续至下一行（月视图跨行续接圆点） */
    contEnd?: boolean
    /** 周跨界：左侧被裁剪 → 左圆角 */
    clipStart?: boolean
    /** 周跨界：右侧被裁剪 → 右圆角 */
    clipEnd?: boolean
}>()
const emit = defineEmits<{ (e: 'open'): void }>()

// @computed 逾期/完成态（A3 语义：逾期红覆盖优先级色；done 永不逾期）
const isDone = computed(() => props.task.state === 'done')
const isOverdue = computed(() => isTaskOverdue(props.task))

// @computed 左缘色条：逾期红 > 优先级（high=error 红 / medium=warning 琥珀 / low 无色）
const barColor = computed<string>(() => {
    if (isOverdue.value) return 'var(--nue-error-color-60)'
    if (props.task.priority === 'high') return 'var(--nue-error-color-60)'
    if (props.task.priority === 'medium') return 'var(--nue-warning-color-60)'
    return 'transparent'
})

// @computed 段首时刻文本（HH:mm）
const timeText = computed(() => {
    if (!props.showTime || !props.task.startAt) return ''
    const start = dayjs(props.task.startAt)
    return start.isValid() ? start.format('HH:mm') : ''
})
</script>

<template>
    <div
        class="cal-item"
        :class="{
            'is-done': isDone,
            'is-overdue': isOverdue,
            'has-cont-start': contStart,
            'has-cont-end': contEnd,
            'clip-start': clipStart,
            'clip-end': clipEnd
        }"
        :style="[pos, { '--cal-pri': barColor }]"
        :title="task.name"
        @click="emit('open')"
    >
        <span v-if="timeText" class="cal-item-time">{{ timeText }}</span>
        <span v-if="contStart" class="cal-cont cal-cont--start" title="承接上一周"></span>
        <span v-if="contEnd" class="cal-cont cal-cont--end" title="续至下一周"></span>
        <span class="cal-item-text">{{ task.name }}</span>
    </div>
</template>

<style scoped>
/* ── 任务条（月/周共用；父级根容器需定义 --cal-* 令牌） ── */
.cal-item {
    position: absolute;
    height: 16px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--cal-chip-bg);
    color: var(--cal-fg);
    font-size: 0.75rem;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
    pointer-events: auto;
    transition: background 60ms;
    box-sizing: border-box;
}
.cal-item:hover {
    background: var(--cal-chip-bg-hover);
}
.cal-item.is-done {
    background: var(--cal-chip-done-bg);
    color: var(--cal-chip-done-fg);
    text-decoration: line-through;
}
.cal-item.is-done:hover {
    background: var(--cal-chip-bg-hover);
}

/* 周跨界单侧圆角（clip = 边界被周裁剪，视觉提示片段） */
.cal-item.clip-start {
    border-top-left-radius: var(--nue-primary-radius);
    border-bottom-left-radius: var(--nue-primary-radius);
}
.cal-item.clip-end {
    border-top-right-radius: var(--nue-primary-radius);
    border-bottom-right-radius: var(--nue-primary-radius);
}

.cal-item-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 2px;
}

/* 左缘色条：优先级色（逾期红覆盖），done 弱化至 ~30% 原色痕 */
.cal-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 1px;
    bottom: 1px;
    width: 2px;
    border-radius: 1px;
    background: var(--cal-pri, transparent);
    pointer-events: none;
}
.cal-item.is-done::before {
    opacity: 0.3;
}

/* 段首时刻文本（HH:mm，随条超宽省略） */
.cal-item-time {
    flex: none;
    margin-right: 6px;
    color: var(--cal-muted);
    font-size: 0.6875rem;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    white-space: nowrap;
}

/* 跨行续接圆点（承接上一行 / 续至下一行；月视图 A4） */
.cal-cont {
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    margin-top: -2.5px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--cal-fg) 58%, var(--cal-bg));
    pointer-events: none;
}
.cal-cont--start {
    left: 3px;
}
.cal-cont--end {
    right: 3px;
}

/* 有续接标记的条体：为圆点预留文本间距（名称 ellipsis 不压圆点） */
.cal-item.has-cont-start {
    padding-left: 14px;
}
.cal-item.has-cont-end {
    padding-right: 14px;
}
</style>