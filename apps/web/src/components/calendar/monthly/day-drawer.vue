<script lang="ts" setup>
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TaskCheckButton } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { isTaskOverdue } from './use-calendar-monthly'

defineOptions({ name: 'CalendarDayDrawer' })

const props = defineProps<{
    open: boolean
    dateKey: string
    tasks: TaskViewObject[]
    onToggleDone: (task: TaskViewObject) => void
    onDefer: (task: TaskViewObject) => void | Promise<void>
    onOpenTask: (taskId: TaskViewObject['id']) => void
    onCreate: () => void
    /** 「本周」下钻：由调用方切周视图并锚定该日（缺省不显示） */
    onGoWeek?: (dateKey: string) => void
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

// @states 延期请求进行中（防重复点击）
const deferringId = ref<TaskViewObject['id']>('')

// @method 延期到今天：调用方负责失败 toast，此处只维护按钮忙态
const runDefer = async (task: TaskViewObject): Promise<void> => {
    if (deferringId.value) return
    deferringId.value = task.id
    try {
        await props.onDefer(task)
    } finally {
        deferringId.value = ''
    }
}

// @computed 抽屉显隐（v-model 桥接）
const visible = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value)
})

// @method 「本周」：关闭抽屉并交由调用方切周视图锚定该日
const goToWeekViewOfDate = () => {
    if (!props.onGoWeek) return
    emit('update:open', false)
    props.onGoWeek(props.dateKey)
}

// @computed 日期标题，如「6 月 3 日 · 周二」
const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const title = computed(() => {
    const d = dayjs(props.dateKey)
    if (!props.dateKey || !d.isValid()) return ''
    return `${d.month() + 1} 月 ${d.date()} 日 · ${weekdayNames[d.day()]}`
})
</script>

<template>
    <nue-drawer
        theme="day-drawer"
        v-model="visible"
        span="min(100%,440px)"
        min-span="340px"
        allow-close-by-overlay
    >
        <template #header="{ close }">
            <!-- 头部 -->
            <nue-div vertical class="dd-title-wrap">
                <nue-text tag="h3" size="var(--nue-text-df)" :weight="600">
                    {{ title }}
                </nue-text>
                <nue-text size="var(--nue-text-sm)" class="dd-sub">
                    {{ tasks.length ? `共 ${tasks.length} 个任务` : '当天暂无任务' }}
                </nue-text>
            </nue-div>
            <nue-div>
                <nue-button
                    v-if="onGoWeek"
                    theme="small,ghost"
                    title="切到该日所在周视图"
                    @click.stop="goToWeekViewOfDate"
                >
                    本周
                </nue-button>
                <nue-button
                    icon="plus"
                    theme="primary,small"
                    :disabled="!dateKey"
                    @click="onCreate"
                >
                    新建任务
                </nue-button>
                <nue-button icon="clear" theme="small,icon" @click="close" />
            </nue-div>
        </template>
        <template #default>
            <template v-if="tasks.length">
                <div
                    v-for="task in tasks"
                    :key="task.id"
                    class="dd-item"
                    :class="{ 'is-done': task.state === 'done', 'is-overdue': isTaskOverdue(task) }"
                    @click="onOpenTask(task.id)"
                >
                    <TaskCheckButton
                        :is-done="task.state === 'done'"
                        @change="onToggleDone(task)"
                    />
                    <span class="dd-name">{{ task.name }}</span>
                    <template v-if="isTaskOverdue(task)">
                        <span class="dd-overdue-chip">已过期</span>
                        <nue-button
                            theme="small,ghost"
                            class="dd-defer-btn"
                            :disabled="deferringId === task.id"
                            @click.stop="runDefer(task)"
                        >
                            {{ deferringId === task.id ? '延期…' : '延期到今天' }}
                        </nue-button>
                    </template>
                </div>
            </template>
            <nue-div v-else vertical align="center" class="dd-empty" gap="4px">
                <nue-text size="var(--nue-text-sm)" class="dd-sub">当天没有任务</nue-text>
                <nue-text size="var(--nue-text-sm)" class="dd-sub">
                    可点击右上角「新建任务」为该日安排任务
                </nue-text>
            </nue-div>
        </template>
    </nue-drawer>
</template>

<style>
.nue-drawer--day-drawer {
    .nue-drawer__header {
        display: flex;
        align-items: center;
        padding: var(--nue-padding-df);
        gap: 8px;
        justify-content: space-between;
        height: auto;
    }

    .nue-drawer__content {
        padding: var(--nue-padding-df) 0;
    }
}
</style>

<style scoped>
.dd-title-wrap {
    gap: 2px;
    align-items: flex-start;
}

.dd-title-wrap .nue-text {
    margin: 0;
}

.dd-sub {
    color: color-mix(in srgb, var(--nue-primary-text-color) 52%, var(--nue-primary-color-0));
}

.dd-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem var(--nue-padding-df);
    cursor: pointer;
    transition: background 60ms;
}
.dd-item:hover {
    background: var(
        --nue-primary-color-50,
        color-mix(in srgb, var(--nue-primary-text-color) 6%, var(--nue-primary-color-0))
    );
}

.dd-item.is-done .dd-name {
    color: color-mix(in srgb, var(--nue-primary-text-color) 45%, var(--nue-primary-color-0));
    text-decoration: line-through;
}

.dd-name {
    font-size: var(--nue-text-df2);
    color: var(--nue-primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}

.dd-overdue-chip {
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--nue-error-color-10);
    color: var(--nue-error-color-80);
    font-size: 0.6875rem;
    line-height: 1.5;
    white-space: nowrap;
}

.dd-defer-btn {
    flex: none;
}

.dd-empty {
    padding: 2.5rem 1rem;
    text-align: center;
}
</style>