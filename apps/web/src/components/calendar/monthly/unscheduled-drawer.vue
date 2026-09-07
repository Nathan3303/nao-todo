<script setup lang="ts">
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { ProjectViewObject } from '@nao-todo/domain-project'
import type { TagViewObject } from '@nao-todo/domain-tag'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { TaskCheckButton } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, reactive, ref, watch } from 'vue'
import { todayDateKey } from './monthly-layout'
import RescheduleMenu from './reschedule-menu.vue'
import type { BatchScheduleResult } from './reschedule'

defineOptions({ name: 'CalendarUnscheduledDrawer' })

const props = defineProps<{
    open: boolean
    tasks: TaskViewObject[]
    filterActive: boolean
    hideCompleted: boolean
    scheduleBusy: boolean
    /** 单条排期/改期写回中的任务 ID（F4 逐任务 busy，来自父级内核） */
    busyTaskId: string
    onToggleDone: (task: TaskViewObject) => void
    onScheduleToDay: (task: TaskViewObject, dateKey: string) => void | Promise<void>
    onBatchScheduleToDay: (tasks: TaskViewObject[], dateKey: string) => Promise<BatchScheduleResult>
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

// @states 多选模式（F3）：模式开关 / 选中集合 / 批量日期面板
const multiMode = ref(false)
const selectedIds = ref<Set<TaskViewObject['id']>>(new Set())
const batchPicking = ref(false)
const batchPickDate = ref<string>('')

// @states 单行「安排到…」菜单（F4 收敛；抽屉行统一为三项裁剪菜单，共享单实例）
const rowMenu = reactive({ open: false, x: 0, y: 0, taskId: '' })

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

// @computed 空态：真无 与 筛选导致 区分（后者给清除出口；B7 语义不回归）
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

// —— 多选模式（F3） ——

// @computed 当前可见行中被选中的数量（隐藏完成/筛选联动后自动收口）
const selectedCount = computed(
    () => props.tasks.filter((task) => selectedIds.value.has(task.id)).length
)

// @method 选中态判定
const isSelected = (taskId: TaskViewObject['id']): boolean => selectedIds.value.has(taskId)

// @method 开关多选模式（进入/退出均清空选择；busy 期锁定）
const toggleMultiMode = (): void => {
    if (props.scheduleBusy) return
    multiMode.value = !multiMode.value
    closeRowMenu()
    batchPicking.value = false
    batchPickDate.value = ''
    selectedIds.value = new Set()
}

// @method 勾选/取消勾选（选择语义，非完成切换）；done 行不可选、busy 期锁定
const toggleSelect = (task: TaskViewObject): void => {
    if (!multiMode.value || props.scheduleBusy || task.state === 'done') return
    const next = new Set(selectedIds.value)
    if (next.has(task.id)) next.delete(task.id)
    else next.add(task.id)
    selectedIds.value = next
}

// @method 行主体点击：普通模式开详情；多选模式整行切换选择（不开详情）
const onMainClick = (task: TaskViewObject): void => {
    if (multiMode.value) return
    props.onOpenTask(task.id)
}

// @method 整行点击（多选模式切换选择）
const onRowClick = (task: TaskViewObject): void => {
    if (!multiMode.value) return
    toggleSelect(task)
}

// @method 复位多选/单行交互状态（抽屉重新打开时回到普通模式，不悬挂选择 UI）
const resetSelectionUI = (): void => {
    multiMode.value = false
    selectedIds.value = new Set()
    batchPicking.value = false
    batchPickDate.value = ''
    closeRowMenu()
}

// @watch 抽屉打开 → 复位（普通模式开始；B7 单行行为不回归）
watch(visible, (open) => {
    if (open) resetSelectionUI()
})

// @watch 列表联动收口：非 busy 时把选择收口到当前可见行；排空自动退出多选（空态出口）
watch(
    () => props.tasks.map((task) => task.id).join(','),
    () => {
        if (props.scheduleBusy) return
        const visibleIds = new Set(props.tasks.map((task) => task.id))
        selectedIds.value = new Set([...selectedIds.value].filter((id) => visibleIds.has(id)))
        if (props.tasks.length === 0) resetSelectionUI()
    }
)

// @method 明天的日期键
const tomorrowDateKey = (): string => dayjs().add(1, 'day').format('YYYY-MM-DD')

// @method 批量执行：串行写回由父级完成；成功后成功项已移出列表，失败项保持选中可原地重试
const runBatch = async (dateKey: string): Promise<void> => {
    if (props.scheduleBusy) return
    const targets = props.tasks.filter((task) => selectedIds.value.has(task.id))
    if (targets.length === 0) return
    const result = await props.onBatchScheduleToDay(targets, dateKey)
    // 成功项移出（数据联动）+ 选择清空；失败项保持选中（重试入口）；抽屉保持打开可连续作业
    selectedIds.value = new Set(result.failedIds)
    // 全部安排完（列表排空）→ 空态出口，多选态自动退出、不悬挂空选择 UI
    if (props.tasks.length === 0) resetSelectionUI()
    batchPicking.value = false
    batchPickDate.value = ''
}

// @method ISO（NueDatePicker 输出）-> YYYY-MM-DD
const keyOfIso = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')

// @method 批量日期面板：确定
const confirmBatchPick = (): void => {
    if (!batchPickDate.value) return
    void runBatch(keyOfIso(batchPickDate.value))
}

// —— 单行「安排到…」菜单（F4 收敛：三项=今天/明天/选择日期…；首位今天=B7 等价） ——

// @method 以「安排到…」按钮为锚点打开菜单（视口边缘收拢）
//              B7 旧行为恢复：done 行单行可安排，disabled 仅随 busy（多选模式 done 排除由 Q4 另管）
const openRowMenu = (task: TaskViewObject, event: Event): void => {
    if (props.scheduleBusy || props.busyTaskId === task.id) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    rowMenu.taskId = task.id
    rowMenu.x = Math.min(Math.max(4, rect.left), window.innerWidth - 208)
    rowMenu.y = Math.min(Math.max(4, rect.bottom + 4), window.innerHeight - 232)
    rowMenu.open = true
}

// @method 收起行内菜单
const closeRowMenu = (): void => {
    rowMenu.open = false
    rowMenu.taskId = ''
}

// @method 菜单选中：交给父级内核串行写回（同 B7 单行语义：未安排=endAt 直写目标日末）
const onRowMenuSelect = (dateKey: string): void => {
    const task = props.tasks.find((item) => item.id === rowMenu.taskId)
    closeRowMenu()
    if (!task) return
    void props.onScheduleToDay(task, dateKey)
}
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
                <nue-button
                    v-if="tasks.length"
                    theme="small,ghost"
                    class="us-multi-toggle"
                    :class="{ 'us-multi-toggle--on': multiMode }"
                    :disabled="scheduleBusy"
                    title="多选：勾选多个任务批量安排到某日（再次点击退出）"
                    @click="toggleMultiMode"
                >
                    多选
                </nue-button>
                <nue-button icon="clear" theme="small,icon" @click="close" />
            </nue-div>
        </template>
        <template #default>
            <template v-if="tasks.length">
                <div v-for="task in tasks" :key="task.id" class="us-item">
                    <!-- 主行 -->
                    <div
                        class="us-item__row"
                        :class="{
                            'is-done': task.state === 'done',
                            'is-multi': multiMode,
                            'is-selected': multiMode && isSelected(task.id),
                            'is-multi-disabled':
                                multiMode && (task.state === 'done' || scheduleBusy)
                        }"
                        :role="multiMode ? 'checkbox' : undefined"
                        :aria-checked="multiMode ? isSelected(task.id) : undefined"
                        @click="onRowClick(task)"
                    >
                        <!-- 行首：普通模式=完成勾选（B7）；多选模式=选择勾（done 置灰不可选） -->
                        <template v-if="multiMode">
                            <button
                                type="button"
                                class="us-select-box"
                                :class="{ 'is-on': isSelected(task.id) }"
                                :disabled="task.state === 'done' || scheduleBusy"
                                :aria-pressed="isSelected(task.id)"
                                aria-label="选择任务"
                                @click.stop="toggleSelect(task)"
                            />
                        </template>
                        <template v-else>
                            <TaskCheckButton
                                :is-done="task.state === 'done'"
                                @change="onToggleDone(task)"
                            />
                        </template>

                        <div class="us-main" @click="onMainClick(task)">
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

                        <!-- 普通模式行内「安排到…」菜单（M2 收敛；B7：done 行单行可安排，禁用仅随 busy；多选模式隐藏） -->
                        <div v-if="!multiMode" class="us-actions" @click.stop>
                            <nue-button
                                theme="small,ghost"
                                :disabled="busyTaskId === task.id"
                                title="安排到某日（含过去日期）"
                                @click="openRowMenu(task, $event)"
                            >
                                {{ busyTaskId === task.id ? '安排中…' : '安排到…' }}
                            </nue-button>
                        </div>
                    </div>
                </div>

                <!-- 行内「安排到…」菜单（共享单实例；抽屉行=未安排 → 三项裁剪） -->
                <reschedule-menu
                    :open="rowMenu.open"
                    :x="rowMenu.x"
                    :y="rowMenu.y"
                    :scheduled="false"
                    :busy="rowMenu.taskId ? busyTaskId === rowMenu.taskId : false"
                    @select="onRowMenuSelect"
                    @close="closeRowMenu"
                />
            </template>
            <!-- 空态（真无/筛选区分出口，B7 不回归） -->
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

        <!-- 多选模式底部操作条：今天 / 明天 / 选择日期…（日期面板支持过去日期） -->
        <template #footer>
            <nue-div v-if="multiMode && tasks.length" vertical class="us-batch" gap="8px">
                <div v-if="batchPicking" class="us-batch__pick">
                    <nue-date-picker
                        v-model="batchPickDate"
                        class="us-batch__picker"
                        type="date"
                        size="small"
                        placeholder="选择日期"
                    />
                    <nue-button
                        theme="primary,small"
                        :disabled="!batchPickDate || scheduleBusy"
                        @click="confirmBatchPick"
                    >
                        {{ scheduleBusy ? '安排中…' : '确定' }}
                    </nue-button>
                </div>
                <nue-div align="center" class="us-batch__bar" gap="6px">
                    <span class="us-batch__count">
                        {{
                            scheduleBusy
                                ? '安排中…'
                                : selectedCount
                                  ? `已选 ${selectedCount} 项`
                                  : '请选择任务'
                        }}
                    </span>
                    <span class="us-batch__spacer" aria-hidden="true"></span>
                    <nue-button
                        theme="small"
                        :disabled="!selectedCount || scheduleBusy"
                        @click="runBatch(todayDateKey())"
                    >
                        今天
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        :disabled="!selectedCount || scheduleBusy"
                        @click="runBatch(tomorrowDateKey())"
                    >
                        明天
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        :disabled="scheduleBusy"
                        @click="batchPicking = !batchPicking"
                    >
                        选择日期…
                    </nue-button>
                </nue-div>
            </nue-div>
        </template>
    </nue-drawer>
</template>

<style>
/* 抽屉外壳样式（NueDrawer 头部/底部经 Teleport 渲染，需全局作用域 + theme 类前缀） */
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

    .nue-drawer__footer {
        padding: var(--nue-padding-df);
        border-top: 1px solid var(--nue-divider-color);
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

/* 头部多选开关（激活态高亮；再次点击退出并清空选择） */
.us-multi-toggle {
    margin-right: 2px;
}

.us-multi-toggle--on {
    background: color-mix(in srgb, var(--nue-primary-text-color) 10%, var(--nue-primary-color-0));
    color: var(--nue-primary-text-color);
    font-weight: 600;
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

/* 多选模式：整行可点切换选择；选中高亮 */
.us-item__row.is-multi {
    user-select: none;
}

.us-item__row.is-selected {
    background: color-mix(in srgb, var(--nue-primary-text-color) 9%, var(--nue-primary-color-0));
}

.us-item__row.is-multi-disabled {
    cursor: default;
    opacity: 0.55;
}

.us-item__row.is-done .us-name {
    color: color-mix(in srgb, var(--nue-primary-text-color) 45%, var(--nue-primary-color-0));
    text-decoration: line-through;
}
.us-item__row.is-done .us-chip {
    opacity: 0.6;
}

/* 多选选择勾（普通方块 → 选中填充对勾） */
.us-select-box {
    flex: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--nue-primary-text-color);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    transition:
        background 60ms,
        border-color 60ms;
}

.us-select-box.is-on {
    background: var(--nue-primary-text-color);
    border-color: var(--nue-primary-text-color);
}

.us-select-box.is-on::after {
    content: '✓';
    color: var(--nue-primary-color-0);
    font-size: 0.75rem;
    line-height: 1;
}

.us-select-box:disabled {
    border-color: color-mix(in srgb, var(--nue-primary-text-color) 30%, var(--nue-primary-color-0));
    cursor: default;
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

/* —— 多选底部操作条 —— */
.us-batch {
    width: 100%;
}

.us-batch__pick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 2px;
}

.us-batch__picker {
    flex: 1;
    min-width: 0;
}

.us-batch__bar {
    width: 100%;
}

.us-batch__count {
    flex: none;
    color: color-mix(in srgb, var(--nue-primary-text-color) 52%, var(--nue-primary-color-0));
    font-size: var(--nue-text-sm);
    line-height: 1;
    white-space: nowrap;
}

.us-batch__spacer {
    flex: 1;
}

.us-empty {
    padding: 2.5rem 1rem;
    text-align: center;
}
</style>