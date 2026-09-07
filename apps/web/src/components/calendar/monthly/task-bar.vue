<script setup lang="ts">
import type { TaskViewObject } from '@nao-todo/domain-task'
import dayjs from 'dayjs'
import { computed, reactive } from 'vue'
import RescheduleMenu from './reschedule-menu.vue'
import { isTaskOverdue } from './use-calendar-monthly'

defineOptions({ name: 'CalendarTaskBar' })

const props = withDefaults(
    defineProps<{
        task: TaskViewObject
        /** 定位样式（父容器按列区间计算 left/width/top） */
        pos: { left: string; width: string; top: string }
        /** 段首显示开始时刻（父容器仅在真起始可见段置 true） */
        showTime?: boolean
        /** 承接上一行（月视图跨行续接圆点） */
        contStart?: boolean
        /** 续至下一行 / 周跨界右侧（延续圆点） */
        contEnd?: boolean
        /** 该任务排期写回中（F4：busy 防连点，禁用菜单入口与项） */
        busy?: boolean
        /** F1：本任务条正在被拖起（原条半透明占位视觉） */
        dragging?: boolean
    }>(),
    { busy: false, dragging: false }
)
const emit = defineEmits<{
    (e: 'open'): void
    /** F4 快速改期：目标日键上抛（语义由父级走 reschedule 内核 + U2 撤销） */
    (e: 'reschedule', dateKey: string): void
    /** F1 拖拽：左键按下（父级接阈值消歧与会话接管） */
    (e: 'drag-pointer-down', event: PointerEvent): void
}>()

// @computed 逾期/完成态（done 永不逾期，两者互斥）
const isDone = computed(() => props.task.state === 'done')
const isOverdue = computed(() => isTaskOverdue(props.task))

// @computed 左缘色条：仅随优先级（high=error 红 / medium=warning 琥珀 / low 无色）；逾期改由背景提示
const barColor = computed<string>(() => {
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

// @computed 菜单锚点（endAt 所在日键；「下周同日」= +7）
const anchorKey = computed(() => dayjs(props.task.endAt).format('YYYY-MM-DD'))

// —— F4 快速改期菜单（右键 contextmenu + 悬停三点，同一命令/同一组件） ——

// @states 菜单开关与锚点坐标
const menuState = reactive({ open: false, x: 0, y: 0 })

// @method 打开菜单（视口边缘向内收拢，避免溢出）
const openMenuAt = (x: number, y: number): void => {
    if (props.busy) return
    menuState.x = Math.min(Math.max(4, x), window.innerWidth - 208)
    menuState.y = Math.min(Math.max(4, y), window.innerHeight - 232)
    menuState.open = true
}

// @method 右键：拦截原生菜单并打开同款菜单（不开详情）
const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    openMenuAt(event.clientX, event.clientY)
}

// @method 三点按钮：以按钮位置为锚点（悬停/聚焦出现；条内小尺寸）
const onMoreClick = (event: MouseEvent): void => {
    event.stopPropagation()
    if (props.busy) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    openMenuAt(rect.right - 4, rect.bottom + 4)
}

// @method 选中目标日 → 上抛（父级串行写回 + U2 toast）；立即收起菜单
const onRescheduleSelect = (dateKey: string): void => {
    menuState.open = false
    emit('reschedule', dateKey)
}

// @method 键盘操作：Enter=开详情（与点击同语义）
const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
        event.stopPropagation()
        emit('open')
    }
}

// @method F1 起拖：左键按下即上抛（F4 三点按钮/右键不受影响；busy 期不起）；
//              阈值内释放仍为点击 → 开详情（点击语义零回归，消歧由会话控制器裁决）
const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    if (target?.closest('.cal-item-more')) return
    if (props.busy || props.dragging) return
    emit('drag-pointer-down', event)
}
</script>

<template>
    <div
        class="cal-item"
        :class="{
            'is-done': isDone,
            'is-overdue': isOverdue,
            'has-cont-start': contStart,
            'has-cont-end': contEnd,
            'is-drag-source': dragging
        }"
        :style="[pos, { '--cal-pri': barColor }]"
        :title="task.name"
        tabindex="0"
        @click="emit('open')"
        @contextmenu="onContextMenu"
        @pointerdown="onPointerDown"
        @keydown="onKeyDown"
    >
        <span v-if="timeText" class="cal-item-time">{{ timeText }}</span>
        <span v-if="contStart" class="cal-cont cal-cont--start" title="承接上一周"></span>
        <span v-if="contEnd" class="cal-cont cal-cont--end" title="续至下一周"></span>
        <span class="cal-item-text">{{ task.name }}</span>
        <nue-button
            theme="pure,icon"
            icon="more-vertical"
            class="cal-item-more"
            title="改期…"
            :disabled="busy"
            @click="onMoreClick"
        />
    </div>

    <!-- F4 快速改期菜单（与右键同命令） -->
    <reschedule-menu
        :open="menuState.open"
        :x="menuState.x"
        :y="menuState.y"
        :scheduled="true"
        :busy="busy"
        :anchor-key="anchorKey"
        @select="onRescheduleSelect"
        @close="menuState.open = false"
    />
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
    outline: none;
}
.cal-item:hover {
    background: var(--cal-chip-bg-hover);
}
.cal-item:focus-visible {
    background: var(--cal-chip-bg-hover);
    outline: 1px solid var(--cal-border);
}
/* 逾期背景提示（A1 冒烟修正）：error-20 浅红；hover/focus-visible 转 error-40（键盘可达性与 hover 同口径） */
.cal-item.is-overdue {
    background: var(--nue-error-color-20);
}
.cal-item.is-overdue:hover,
.cal-item.is-overdue:focus-visible {
    background: var(--nue-error-color-40);
}
.cal-item.is-done {
    background: var(--cal-chip-done-bg);
    color: var(--cal-chip-done-fg);
    text-decoration: line-through;
}
.cal-item.is-done:hover {
    background: var(--cal-chip-bg-hover);
}

.cal-item-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 2px;
}

/* 左缘色条：优先级色（high=红 / medium=琥珀 / low 无色），done 弱化至 ~30% 原色痕；逾期底色另见 .cal-item.is-overdue */
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

/* F4 三点按钮（NueButton pure/icon + more-vertical）：悬停/聚焦时才出现（条内小尺寸，不挤名称） */
.cal-item-more {
    --nue-button-font-size: 0.75rem;
    --nue-button-color: var(--cal-muted);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-left: 2px;
    box-sizing: border-box;
    overflow: hidden;
    color: var(--cal-muted);
    opacity: 0;
    transition:
        opacity 60ms,
        background 60ms;
    pointer-events: auto;
}
.cal-item:hover .cal-item-more,
.cal-item:focus-within .cal-item-more,
.cal-item-more:focus-visible {
    opacity: 1;
}
.cal-item-more:hover:not(:disabled) {
    border-radius: 3px;
    background: color-mix(in srgb, var(--cal-fg) 14%, var(--cal-bg));
}
.cal-item-more:disabled {
    cursor: default;
}

/* F1 拖起中的原条：半透明占位（不阻碍落点命中） */
.cal-item.is-drag-source {
    opacity: 0.35;
    cursor: grabbing;
}
</style>