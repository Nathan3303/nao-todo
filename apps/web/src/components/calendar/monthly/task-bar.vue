<script setup lang="ts">
import type { TaskViewObject } from '@nao-todo/domain-task'
import dayjs from 'dayjs'
import { computed } from 'vue'
import RescheduleMenu from './reschedule-menu.vue'
import { isTaskOverdue } from './overdue'

defineOptions({ name: 'CalendarTaskBar' })

const props = withDefaults(
    defineProps<{
        task: TaskViewObject
        /** 定位样式（父容器按列区间计算 left/width/top） */
        pos: { left: string; width: string; top: string }
        /** 段末显示截止时刻（父容器仅在真末段可见段置 true） */
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

// @computed 段末截止时刻文本（HH:mm）
const timeText = computed(() => {
    if (!props.showTime || !props.task.endAt) return ''
    const end = dayjs(props.task.endAt)
    return end.isValid() ? end.format('HH:mm') : ''
})

// @computed 菜单锚点（endAt 所在日键；「下周同日」= +7）
const anchorKey = computed(() => dayjs(props.task.endAt).format('YYYY-MM-DD'))

// —— F4 快速改期菜单（TASK-10：三点按钮为 NueDropdown 触发器；右键菜单已移除） ——

// @method F1 起拖：左键按下即上抛（F4 三点按钮不受影响；busy 期不起）；
//              阈值内释放仍为点击 → 开详情（点击语义零回归，消歧由会话控制器裁决）
const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    if (target?.closest('.cal-item-more')) return
    if (props.busy || props.dragging) return
    emit('drag-pointer-down', event)
}

// @method 键盘操作：Enter=开详情（与点击同语义）
const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
        event.stopPropagation()
        emit('open')
    }
}
</script>

<template>
    <div
        class="cal-item"
        role="button"
        :class="{
            'is-done': isDone,
            'is-overdue': isOverdue,
            'has-cont-start': contStart,
            'has-cont-end': contEnd,
            'is-drag-source': dragging
        }"
        :style="[pos, { '--cal-pri': barColor }]"
        :title="task.name"
        :aria-label="task.name"
        tabindex="0"
        @click="emit('open')"
        @contextmenu.prevent
        @pointerdown="onPointerDown"
        @keydown="onKeyDown"
    >
        <span class="cal-item-text">{{ task.name }}</span>
        <span v-if="timeText" class="cal-item-time">{{ timeText }}</span>
        <!-- F4 三点按钮 = NueDropdown（reschedule-menu）触发器；悬停/聚焦出现；已开再点收起 -->
        <reschedule-menu
            :scheduled="true"
            :busy="busy"
            :anchor-key="anchorKey"
            @select="emit('reschedule', $event)"
        >
            <template #trigger="{ trigger }">
                <nue-button
                    theme="pure,icon"
                    icon="more-vertical"
                    class="cal-item-more"
                    title="改期…"
                    :disabled="busy"
                    @click="trigger"
                />
            </template>
        </reschedule-menu>
    </div>
</template>

<style scoped>
/* ── 任务条（月/周共用；父级根容器需定义 --cal-* 令牌） ── */
.cal-item {
    position: absolute;
    height: 20px; /* TASK-07：16→20 行高增加（GRID_ITEM_STEP 同步 22） */
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--cal-chip-bg);
    color: var(--cal-fg);
    font-size: 0.75rem;
    line-height: 20px;
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
    background: var(--nue-error-color-10);
}
.cal-item.is-overdue:hover,
.cal-item.is-overdue:focus-visible {
    background: var(--nue-error-color-20);
}
.cal-item.is-done {
    background: var(--cal-chip-done-bg);
    color: var(--cal-chip-done-fg);

    span {
        text-decoration: line-through;
    }
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

/* 段末截止时刻文本（HH:mm，随条超宽省略） */
.cal-item-time {
    flex: none;
    margin-left: 6px;
    color: var(--cal-muted);
    font-size: 0.6875rem;
    line-height: 18px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    white-space: nowrap;
}

/* 跨行续接圆点已移除（TASK-07：仅视觉，contStart/contEnd 数据承接语义保留） */

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