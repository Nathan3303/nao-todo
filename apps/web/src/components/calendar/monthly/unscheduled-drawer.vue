<script setup lang="ts">
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { ProjectViewObject } from '@nao-todo/domain-project'
import type { TagViewObject } from '@nao-todo/domain-tag'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { TaskCheckButton } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { todayDateKey } from './monthly-layout'

defineOptions({ name: 'CalendarUnscheduledDrawer' })

const props = defineProps<{
    open: boolean
    tasks: TaskViewObject[]
    filterActive: boolean
    hideCompleted: boolean
    onToggleDone: (task: TaskViewObject) => void
    onScheduleToDay: (task: TaskViewObject, dateKey: string) => void | Promise<void>
    onOpenTask: (taskId: TaskViewObject['id']) => void
    onClearFilter: () => void
    onShowCompleted: () => void
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

// @computed 抽屉显隐（v-model 桥接）
const visible = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value)
})

// @states 行内操作：安排中 / 展开日期选择的行 / 待选日期
const busyId = ref<TaskViewObject['id']>('')
const pickingId = ref<TaskViewObject['id']>('')
const pickDate = ref<string>('')

// @computed 行上下文（清单名 + 标签，缺数据时优雅降级为空）
type RowMeta = { project?: ProjectViewObject; tags: TagViewObject[] }
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const metaOf = (task: TaskViewObject): RowMeta => ({
    project: task.projectId ? projectsStore.getProject(task.projectId) : undefined,
    tags: task.tags
        .map((tagId) => tagsStore.getTag(tagId))
        .filter((tag): tag is TagViewObject => !!tag)
})

// @computed 空态：真无 与 筛选导致 区分（后者给清除出口）
const emptyHint = computed<{ text: string; action: string; run: () => void } | null>(() => {
    if (props.tasks.length) return null
    if (props.filterActive) {
        return {
            text: '当前筛选条件下暂无未安排任务',
            action: '清除筛选',
            run: props.onClearFilter
        }
    }
    if (props.hideCompleted) {
        return { text: '已隐藏已完成任务', action: '显示已完成', run: props.onShowCompleted }
    }
    return null
})

// @method 安排任务到某日（dateKey YYYY-MM-DD；成功后任务移出列表由数据联动完成）
const runSchedule = async (task: TaskViewObject, dateKey: string): Promise<void> => {
    if (busyId.value) return
    busyId.value = task.id
    try {
        await props.onScheduleToDay(task, dateKey)
    } finally {
        busyId.value = ''
        if (pickingId.value === task.id) {
            pickingId.value = ''
            pickDate.value = ''
        }
    }
}

// @method 展开/收起某行的日期选择
const togglePick = (task: TaskViewObject) => {
    pickingId.value = pickingId.value === task.id ? '' : task.id
    pickDate.value = ''
}

// @method ISO（NueDatePicker 输出）-> YYYY-MM-DD
const keyOfIso = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')
</script>

<template>
    <nue-drawer
        theme="unscheduled-drawer"
        v-model="visible"
        span="min(100%, 480px)"
        min-span="360px"
        allow-close-by-overlay
    >
        <template #header="{ close }">
            <nue-div vertical class="us-title-wrap">
                <nue-text tag="h3" size="var(--nue-text-df)" :weight="600"> 未安排任务 </nue-text>
                <nue-text size="var(--nue-text-sm)" class="us-sub">
                    {{ tasks.length ? `共 ${tasks.length} 个` : '暂无未安排任务' }}
                </nue-text>
            </nue-div>
            <nue-div>
                <nue-button icon="clear" theme="small,icon" @click="close" />
            </nue-div>
        </template>
        <template #default>
            <template v-if="tasks.length">
                <div v-for="task in tasks" :key="task.id" class="us-item">
                    <!-- 主行：勾选 + 名称/上下文 + 行内操作（点击行打开详情） -->
                    <div class="us-item__row" :class="{ 'is-done': task.state === 'done' }">
                        <TaskCheckButton
                            :is-done="task.state === 'done'"
                            @change="onToggleDone(task)"
                        />
                        <div class="us-main" @click="onOpenTask(task.id)">
                            <div class="us-name" :title="task.name">{{ task.name }}</div>
                            <div
                                v-if="metaOf(task).project || metaOf(task).tags.length"
                                class="us-meta"
                            >
                                <span
                                    v-if="metaOf(task).project"
                                    class="us-chip"
                                    :title="`清单 · ${metaOf(task).project!.name}`"
                                >
                                    {{ metaOf(task).project!.name }}
                                </span>
                                <span
                                    v-for="tag in metaOf(task).tags"
                                    :key="tag.id"
                                    class="us-chip us-chip--tag"
                                    :style="{ '--tag-color': tag.color }"
                                    :title="tag.name"
                                >
                                    <i class="us-chip__dot"></i>
                                    {{ tag.name }}
                                </span>
                            </div>
                        </div>
                        <div class="us-actions" @click.stop>
                            <nue-button
                                theme="small"
                                :disabled="busyId === task.id"
                                @click="runSchedule(task, todayDateKey())"
                            >
                                {{ busyId === task.id ? '安排…' : '安排到今天' }}
                            </nue-button>
                            <nue-button
                                theme="small,ghost"
                                :disabled="busyId === task.id"
                                @click="togglePick(task)"
                            >
                                选择日期…
                            </nue-button>
                        </div>
                    </div>
                    <!-- 展开：日期选择 + 确定 -->
                    <div v-if="pickingId === task.id" class="us-pick" @click.stop>
                        <nue-date-picker
                            v-model="pickDate"
                            class="us-pick__picker"
                            type="date"
                            size="small"
                            placeholder="选择日期"
                        />
                        <nue-button
                            theme="primary,small"
                            :disabled="!pickDate || busyId === task.id"
                            @click="runSchedule(task, keyOfIso(pickDate))"
                        >
                            {{ busyId === task.id ? '安排…' : '确定' }}
                        </nue-button>
                    </div>
                </div>
            </template>
            <!-- 空态 -->
            <nue-div v-else vertical align="center" class="us-empty" gap="4px">
                <template v-if="emptyHint">
                    <nue-text size="var(--nue-text-sm)" class="us-sub">
                        {{ emptyHint.text }}
                    </nue-text>
                    <nue-button theme="primary,small" @click="emptyHint.run">
                        {{ emptyHint.action }}
                    </nue-button>
                </template>
                <template v-else>
                    <nue-text size="var(--nue-text-sm)" class="us-sub"> 暂无未安排任务 </nue-text>
                    <nue-text size="var(--nue-text-sm)" class="us-sub">
                        新建任务时选择日期即可排入日历
                    </nue-text>
                </template>
            </nue-div>
        </template>
    </nue-drawer>
</template>

<style>
/* 抽屉外壳样式（NueDrawer 头部经 Teleport 渲染，需全局作用域 + theme 类前缀） */
.nue-drawer--unscheduled-drawer {
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
.us-title-wrap {
    gap: 2px;
    align-items: flex-start;
}

.us-title-wrap .nue-text {
    margin: 0;
}

.us-sub {
    color: color-mix(in srgb, var(--nue-primary-text-color) 52%, var(--nue-primary-color-0));
}

.us-item {
    border-bottom: 1px solid var(--nue-divider-color);
}

.us-item__row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem var(--nue-padding-df);
    cursor: pointer;
    transition: background 60ms;
}
.us-item__row:hover {
    background: var(
        --nue-primary-color-50,
        color-mix(in srgb, var(--nue-primary-text-color) 6%, var(--nue-primary-color-0))
    );
}

.us-item__row.is-done .us-name {
    color: color-mix(in srgb, var(--nue-primary-text-color) 45%, var(--nue-primary-color-0));
    text-decoration: line-through;
}
.us-item__row.is-done .us-chip {
    opacity: 0.6;
}

.us-main {
    flex: 1;
    min-width: 0;
}

.us-name {
    font-size: var(--nue-text-df2);
    color: var(--nue-primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.us-meta {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 6px;
    margin-top: 2px;
    overflow: hidden;
}

.us-chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 140px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(
        --nue-primary-color-50,
        color-mix(in srgb, var(--nue-primary-text-color) 6%, var(--nue-primary-color-0))
    );
    color: color-mix(in srgb, var(--nue-primary-text-color) 62%, var(--nue-primary-color-0));
    font-size: 0.6875rem;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.us-chip--tag {
    background: transparent;
}

.us-chip__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tag-color);
    flex: none;
}

.us-actions {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.us-pick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.5rem var(--nue-padding-df) 0.75rem calc(var(--nue-padding-df) + 2rem);
}

.us-pick__picker {
    flex: 1;
    min-width: 0;
}

.us-empty {
    padding: 2.5rem 1rem;
    text-align: center;
}
</style>