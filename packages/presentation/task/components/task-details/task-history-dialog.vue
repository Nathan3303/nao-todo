<script setup lang="ts">
/**
 * 任务详情「变更历史」对话框（A 档审计日志 · `T712` / `R-10` / `AC12`）
 *
 * @description 入口 = Footer「更多」菜单项「变更历史」（`D8`，⛔ 详情正文不再内联）：
 *              查阅型信息「用时打开、看完关闭」。本组件 = 对话框壳 + 活动流内容。
 *              - **展示形态 = 活动流（activity feed，`D9` / `AC13`，2026-11-12 用户定）**：
 *                参照 GitHub 活动流 / Linear 按天分组 / Notion 行式列表 ——
 *                每行 = 20px 圆形来源徽标（色 + 符号 + 文字三重冗余）+ 主文案一行
 *                （`来源中文 · 字段名: 旧 → 新`，多字段以 `·` 分隔）+ 右侧时间；
 *                ⛔ **不出现左侧色条 / 竖线 / 时间轴轨道**（原四条 `border-left` 已删）；
 *                ⛔ 不出现表格 / 网格线（C 端红线），组内只靠 8px 留白分隔
 *              - 按天轻分组（今天 / 昨天 / 更早）：组标题小字 + 组间 16px 留白；
 *                分页入口 = 列表末尾的独立「更早的记录」按钮（`hasMore` 时才渲染，
 *                ⛔ 不把组标题当按钮用）
 *              - 整行可点（原生 `button` ⇒ Tab 可达、Enter 展开）；长值单行省略 +
 *                `title` 给全文，展开后换行显示结构化字段差异（展开区有高度上限 + 内滚）
 *              - 关闭三路：Esc / `×`（`NueDialog` 原生）· 底部「关闭」按钮；**焦点归还**由触发方
 *                （footer）负责 —— 对话框不持有触发项引用
 *              - 打开按 `taskId`（entityId）加载；关闭即卸载内容并清空本组件状态（`generation`
 *                丢弃在途响应）⇒ 无残留
 *              - `R-10` 硬要求③：打开期间详情页自动刷新（`vo` 换新对象、`taskId` 不变）
 *                **不重挂、不清空**列表 —— 加载只由「打开 / 换任务」触发
 *              - 文案：字段名复用 `conflict-field-labels`（与冲突面板同一份）；框架文案用
 *                `history.*`（`R-7` 预算 **16 键**：`D9` 后 13 → 16，新增 3 个分组标题键）+
 *                `common.close` + `sync.conflict.expand/collapse`；相对时间复用
 *                `parse2RelativeDate`（内部 `date.today` / `date.yesterday` …）
 * @see docs/prds/2026-11-10-audit-log.md（R-10 / AC12 / AC13 / D9）
 */
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { fieldLabel } from '@nao-todo/shared/utils/conflict-field-labels'
import { parse2RelativeDate } from '@nao-todo/shared/utils/relative-date-parser'
import { computed, inject, ref, watch } from 'vue'
import { TASK_HISTORY_CONTEXT_KEY, type TaskHistoryItem } from './context'

defineOptions({ name: 'TaskHistoryDialog' })

const props = withDefaults(defineProps<{ modelValue: boolean; taskId?: string }>(), {
    taskId: ''
})

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const history = inject(TASK_HISTORY_CONTEXT_KEY, null)

const items = ref<TaskHistoryItem[]>([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
/** 切换任务 / 关闭时丢弃过期响应（防旧任务结果覆盖新任务） */
let generation = 0

/** 来源 → 文案键（⛔ 不把原始来源值放进 DOM） */
const SOURCE_KEYS: Record<TaskHistoryItem['source'], LocaleKey> = {
    'local-edit': 'history.source.local',
    pull: 'history.source.pull',
    'push-merge': 'history.source.pushMerge',
    'conflict-retry': 'history.source.conflictRetry'
}

/** 动作 → 文案键（`update` 无标签：字段差异本身即说明，见 `R-7` 的 5 个动作键） */
const ACTION_KEYS: Partial<Record<TaskHistoryItem['action'], LocaleKey>> = {
    create: 'history.action.create',
    archive: 'history.action.archive',
    unarchive: 'history.action.unarchive',
    delete: 'history.action.delete',
    restore: 'history.action.restore'
}

/** 来源 → 样式修饰（徽标颜色 + 符号 + 文字三重冗余；类名不含内部值） */
const SOURCE_TONES: Record<TaskHistoryItem['source'], string> = {
    'local-edit': 'self',
    pull: 'cloud',
    'push-merge': 'merged',
    'conflict-retry': 'restored'
}

/** 来源 → 符号（去色后仍可区分） */
const SOURCE_ICONS: Record<TaskHistoryItem['source'], string> = {
    'local-edit': '✎',
    pull: '☁',
    'push-merge': '⇄',
    'conflict-retry': '↺'
}

const sourceLabel = (source: TaskHistoryItem['source']): string => t(SOURCE_KEYS[source])
const sourceTone = (source: TaskHistoryItem['source']): string => SOURCE_TONES[source]
const sourceIcon = (source: TaskHistoryItem['source']): string => SOURCE_ICONS[source]
const actionLabel = (action: TaskHistoryItem['action']): string => {
    const key = ACTION_KEYS[action]
    return key ? t(key) : ''
}

/** 相对时间（复用既有工具：今天 14:32 / 昨天 09:12 / 上周四 08:00） */
const relativeTime = (at: string): string => parse2RelativeDate(at) ?? ''

/** 优先级短标签白名单（避免未知名被当成 i18n 键） */
const PRIORITY_SHORTS: Record<string, true> = {
    high: true,
    medium: true,
    low: true,
    urgent: true,
    none: true
}

/** 状态枚举（兼容历史 `doing` / camelCase 写法） */
const STATE_KEYS: Record<string, LocaleKey> = {
    todo: 'task.state.todo',
    'in-progress': 'task.state.inProgress',
    inProgress: 'task.state.inProgress',
    doing: 'task.state.inProgress',
    done: 'task.state.done'
}

/**
 * 值 → 可读文本
 * @description ⛔ 不新增 i18n 键：空值复用 `sync.conflict.value.unset`、优先级/状态复用既有标签；
 *              未知值原样显示（不崩、不吞）。
 */
const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return t('sync.conflict.value.unset')
    }
    if (Array.isArray(value)) {
        return value.length === 0
            ? t('sync.conflict.value.unset')
            : value.map((item) => String(item)).join('、')
    }
    if (field === 'priority' && typeof value === 'string') {
        const key = `task.priority.short.${value}` as LocaleKey
        return value in PRIORITY_SHORTS ? t(key) : String(value)
    }
    if (field === 'state' && typeof value === 'string') {
        const key = STATE_KEYS[value]
        return key ? t(key) : String(value)
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return parse2RelativeDate(value) ?? value
    }
    if (typeof value === 'boolean') return value ? '✓' : '—'
    return String(value)
}

/** 单条差异 → `字段名: 旧 → 新`（`create` 无旧值 ⇒ 只显示新值） */
const diffText = (item: TaskHistoryItem, diff: TaskHistoryItem['fields'][number]): string => {
    const label = fieldLabel(diff.field)
    if (item.action === 'create') return `${label}: ${formatValue(diff.field, diff.to)}`
    const from = formatValue(diff.field, diff.from)
    return `${label}: ${from} → ${formatValue(diff.field, diff.to)}`
}

/** 主文案（一行，超长由 CSS 省略 + `title` 给全文；展开后可换行） */
const summaryText = (item: TaskHistoryItem): string => {
    const parts = [sourceLabel(item.source)]
    const action = actionLabel(item.action)
    if (action) parts.push(action)
    for (const diff of item.fields) parts.push(diffText(item, diff))
    return parts.join(' · ')
}

/** 条目稳定标识（分页游标优先；无 `seq` 时退回时间） */
const itemKey = (item: TaskHistoryItem): string => String(item.seq ?? item.at)

/** 展开的条目（长值 / 多字段差异逐行显示；关闭或换任务即清空） */
const expandedKeys = ref<Set<string>>(new Set())
const isExpanded = (item: TaskHistoryItem): boolean => expandedKeys.value.has(itemKey(item))

/** 只有带字段差异的条目才可展开（`archive` / `delete` / `restore` 等墓碑动作 `fields` 为空 ⇒ 无内容可展开） */
const canExpand = (item: TaskHistoryItem): boolean => item.fields.length > 0

const toggle = (item: TaskHistoryItem): void => {
    if (!canExpand(item)) return
    const key = itemKey(item)
    const next = new Set(expandedKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedKeys.value = next
}

/** 天分组（本地日界；`更早` 含本周 / 本月 / 更久） */
type GroupKey = 'today' | 'yesterday' | 'earlier'

const GROUP_ORDER: GroupKey[] = ['today', 'yesterday', 'earlier']

/**
 * 分组标题 → 专用键（`D9` / `AC13`；`R-7` 预算 13 → **16**：分组标题是真实需求，⛔ 不挪用
 * 无语义键 —— `settings.sessionYesterday` / `history.more` 各有本义，混用即「一名两义」）
 */
const GROUP_KEYS: Record<GroupKey, LocaleKey> = {
    today: 'history.group.today',
    yesterday: 'history.group.yesterday',
    earlier: 'history.group.earlier'
}

const startOfDay = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const dayBucket = (at: string): GroupKey => {
    const date = new Date(at)
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
    if (days <= 0) return 'today'
    return days === 1 ? 'yesterday' : 'earlier'
}

/**
 * 按天轻分组（最新在前，组序固定；⛔ 空组不渲染）
 */
const groups = computed(() => {
    const buckets = new Map<GroupKey, TaskHistoryItem[]>()
    for (const item of items.value) {
        const key = dayBucket(item.at)
        const bucket = buckets.get(key)
        if (bucket) bucket.push(item)
        else buckets.set(key, [item])
    }
    return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
        key,
        label: t(GROUP_KEYS[key]),
        items: buckets.get(key) ?? []
    }))
})

/**
 * 拉取一页历史
 * @param beforeSeq keyset 游标（缺省 = 最新一页）；「更早」传当前最旧一条的 `seq`
 */
const load = async (beforeSeq?: number): Promise<void> => {
    if (!history || !props.taskId) return
    const current = generation
    loading.value = true
    error.value = ''
    try {
        const page = await history.load(props.taskId, beforeSeq)
        if (current !== generation) return
        hasMore.value = page.hasMore
        items.value = beforeSeq === undefined ? page.items : [...items.value, ...page.items]
    } catch {
        if (current !== generation) return
        // 读取失败 ⇒ 可见失败态（不静默），文案说人话
        error.value = t('history.loadFailed')
    } finally {
        if (current === generation) loading.value = false
    }
}

/** 「更早」：按最旧一条的 `seq` 续页（⛔ 不用 offset，插入序会漂） */
const loadMore = async (): Promise<void> => {
    const oldest = items.value[items.value.length - 1]
    if (!oldest || oldest.seq === undefined) return
    await load(oldest.seq)
}

/**
 * 打开 / 换任务才加载；关闭即清空（无残留）
 * @description 只依赖「是否打开」与 `taskId`（⛔ 不依赖详情页内容）⇒ 打开期间自动刷新
 *              （`vo` 换新对象）不会重挂或清空列表（`R-10` 硬要求③）
 */
watch(
    () => [props.modelValue, props.taskId] as const,
    ([isOpen]) => {
        generation += 1
        items.value = []
        hasMore.value = false
        error.value = ''
        loading.value = false
        expandedKeys.value = new Set()
        if (isOpen) void load()
    },
    { immediate: true }
)

const requestClose = (): void => emit('update:modelValue', false)

const hasContent = computed(() => items.value.length > 0)
</script>

<template>
    <nue-dialog
        :model-value="props.modelValue"
        :title="t('history.title')"
        theme="task-history"
        @update:model-value="(value) => emit('update:modelValue', Boolean(value))"
    >
        <template #content>
            <loading-error
                :loading="loading"
                :error="error.length > 0"
                :empty="!loading && !error && !hasContent"
                :empty-message="t('history.empty')"
                :error-message="t('history.loadFailed')"
            >
                <div class="task-history">
                    <div class="task-history__list">
                        <div v-for="group in groups" :key="group.key" class="task-history__group">
                            <p class="task-history__group-title">{{ group.label }}</p>

                            <div class="task-history__rows">
                                <button
                                    v-for="item in group.items"
                                    :key="itemKey(item)"
                                    type="button"
                                    class="task-history__entry"
                                    :class="[
                                        `task-history__entry--${sourceTone(item.source)}`,
                                        { 'is-expanded': isExpanded(item) }
                                    ]"
                                    :aria-expanded="canExpand(item) ? isExpanded(item) : undefined"
                                    :title="summaryText(item)"
                                    @click="toggle(item)"
                                >
                                    <span
                                        class="task-history__badge"
                                        :class="`task-history__badge--${sourceTone(item.source)}`"
                                        aria-hidden="true"
                                    >
                                        {{ sourceIcon(item.source) }}
                                    </span>
                                    <span class="task-history__body">
                                        <span class="task-history__summary">
                                            {{ summaryText(item) }}
                                        </span>
                                        <span v-if="isExpanded(item)" class="task-history__detail">
                                            <span
                                                v-for="diff in item.fields"
                                                :key="diff.field"
                                                class="task-history__detail-row"
                                            >
                                                <span class="task-history__detail-name">
                                                    {{ fieldLabel(diff.field) }}
                                                </span>
                                                <span class="task-history__detail-value">
                                                    <template v-if="item.action !== 'create'">
                                                        <span class="task-history__from">
                                                            {{ formatValue(diff.field, diff.from) }}
                                                        </span>
                                                        <span
                                                            class="task-history__arrow"
                                                            aria-hidden="true"
                                                        >
                                                            →
                                                        </span>
                                                    </template>
                                                    <span class="task-history__to">
                                                        {{ formatValue(diff.field, diff.to) }}
                                                    </span>
                                                </span>
                                            </span>
                                        </span>
                                    </span>
                                    <span
                                        v-if="canExpand(item)"
                                        class="task-history__toggle"
                                        aria-hidden="true"
                                    >
                                        {{
                                            isExpanded(item)
                                                ? t('sync.conflict.collapse')
                                                : t('sync.conflict.expand')
                                        }}
                                    </span>
                                    <time class="task-history__time" :datetime="item.at">
                                        {{ relativeTime(item.at) }}
                                    </time>
                                </button>
                            </div>
                        </div>
                        <nue-button
                            v-if="hasMore"
                            class="task-history__more"
                            theme="pure,small"
                            @click="loadMore"
                        >
                            {{ t('history.more') }}
                        </nue-button>
                    </div>
                </div>
            </loading-error>
        </template>
        <template #footer>
            <div class="task-history__footer">
                <nue-button theme="primary" @click="requestClose">
                    {{ t('common.close') }}
                </nue-button>
            </div>
        </template>
    </nue-dialog>
</template>

<style>
/* NueDialog 传送至 body 弹层池 ⇒ 宿主级样式需非 scoped */
.nue-dialog.nue-dialog--task-history {
    width: min(92vw, 32rem);
}

.nue-dialog--task-history .nue-dialog__content {
    padding: 0;
}
</style>

<style scoped>
.task-history {
    width: 100%;
}

/* 列表：查阅型信息 ⇒ 框内滚动，标题与底部按钮常驻 */
.task-history__list {
    display: flex;
    flex-direction: column;
    /* 组间 16px 留白（⛔ 无分隔线、⛔ 无竖线） */
    gap: var(--nue-gap-df);
    width: 100%;
    max-height: min(58vh, 26rem);
    padding: var(--nue-padding-xs);
    overflow: auto;
    box-sizing: border-box;
}

.task-history__group {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
}

/* 组标题：小字 + 次要色（今天 / 昨天 / 更早，专用键 `history.group.*`） */
.task-history__group-title {
    margin: 0;
    padding: 0 var(--nue-padding-xs);
    font-size: var(--nue-text-xs);
    font-weight: 500;
    /* 小文本 ≥4.5:1 ⇒ 用次要文字色（DESIGN §2：5.74:1 @ 白底） */
    color: var(--nue-secondary-text-color);
    text-align: left;
}

/* 「更早的记录」分页入口（复用既有 `history.more`；组标题另有专用键）
   点击区 ≥40px（DESIGN §3）：`pure` 会把 `small` 的 28px 高度归零（实测 17px）⇒ 显式给足 */
.task-history__more {
    align-self: flex-start;
    min-height: 40px;
    padding: 0 var(--nue-padding-xs);
    font-size: var(--nue-text-xs);
    color: var(--nue-secondary-text-color);
}

/* 组内 8px 留白（⛔ 表格线 / 极淡分隔线一律不用） */
.task-history__rows {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

/*
 * 活动流行：整行可点（原生 button ⇒ Tab / Enter 天然可达、焦点环可见）
 * ⛔ 无左侧色条 / 无竖线 / 无轨道（原四条 border-left 已删，`D9` / `AC13`）
 */
.task-history__entry {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    width: 100%;
    min-height: 44px;
    padding: var(--nue-padding-2xs) var(--nue-padding-xs);
    border: 0;
    border-radius: var(--nue-radius-lg);
    background-color: transparent;
    color: var(--nue-primary-text-color);
    font: inherit;
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color var(--nue-animation-duration-short)
        var(--nue-animation-timing-function);
}

@media (prefers-reduced-motion: reduce) {
    .task-history__entry {
        transition: none;
    }
}

/* 可点行 hover / focus 只用主题 token（⛔ 硬编码色值） */
.task-history__entry:hover {
    background-color: var(--nue-primary-color-100);
}

.task-history__entry:focus-visible {
    background-color: var(--nue-primary-color-100);
    outline: 2px solid var(--nue-primary-color-700);
    outline-offset: -2px;
}

/* 来源徽标：20px 圆形（颜色 + 符号 + 文字三重冗余 ⇒ 色只是辅助） */
.task-history__badge {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: var(--nue-text-xs);
    line-height: 1;
}

/*
 * 来源徽标 4 色：实心圆 + 浅色符号（色只是辅助 —— 主要区分手段是符号 + 来源文字）
 * 实心填色使「徽标 vs 行底色」也达图形 ≥3:1（浅色主题实测 4.95–12.63，深色 6.5–10.8）
 */
.task-history__badge--self {
    background-color: var(--nue-primary-color-800);
    color: var(--nue-primary-color-0);
}

/* 同步自云端（云端带来的变更） */
.task-history__badge--cloud {
    background-color: var(--nue-success-color-90);
    color: var(--nue-primary-color-0);
}

/* 已合并云端修改（两边都动过，值得留意） */
.task-history__badge--merged {
    background-color: var(--nue-warning-color-90);
    color: var(--nue-primary-color-0);
}

/* 恢复了我的修改（覆盖了云端那次） */
.task-history__badge--restored {
    background-color: var(--nue-error-color-90);
    color: var(--nue-primary-color-0);
}

.task-history__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* 主文案：1 行省略（全文在 `title`；点击整行展开换行） */
.task-history__summary {
    display: block;
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/*
 * 展开后面的**主文案仍保持 1 行省略**（全文看下方可滚的字段差异区）—— 否则长值会在主文案里
 * 无限换行，一条就顶满列表（实测 450px = 列表可视高的 108%）
 */
.task-history__entry.is-expanded .task-history__summary {
    white-space: nowrap;
}

/* 展开后：字段差异逐行（`create` 只有新值）；高度上限 + 内滚 ⇒ 一条不把列表顶满 */
.task-history__detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 6.5rem;
    overflow: auto;
    font-size: var(--nue-text-xs);
    color: var(--nue-secondary-text-color);
}

.task-history__detail-row {
    display: flex;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    flex-wrap: wrap;
}

.task-history__detail-value {
    display: inline-flex;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    overflow-wrap: anywhere;
}

.task-history__from {
    color: var(--nue-secondary-text-color);
    text-decoration: line-through;
}

.task-history__arrow {
    color: var(--nue-secondary-text-color);
}

.task-history__to {
    color: var(--nue-primary-text-color);
}

/* 展开 / 收起：复用既有 `sync.conflict.expand|collapse`（⛔ 不新增键） */
.task-history__toggle {
    flex: none;
    font-size: var(--nue-text-xs);
    color: var(--nue-secondary-text-color);
}

/* 右侧时间：次要色 12px + 等宽数字 */
.task-history__time {
    flex: none;
    font-size: var(--nue-text-xs);
    color: var(--nue-secondary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.task-history__footer {
    display: flex;
    justify-content: flex-end;
    width: 100%;
}
</style>