<script setup lang="ts">
/**
 * 任务详情「变更历史」对话框（A 档审计日志 · `T712` / `R-10` / `AC12`）
 *
 * @description 入口 = Footer「更多」菜单项「变更历史」（`D8`，⛔ 详情正文不再内联）：
 *              查阅型信息「用时打开、看完关闭」。本组件 = 对话框壳 + 时间线内容。
 *              - C 端形态：时间线**卡片**（非表格式），点击区 ≥ 40px；三态复用 `LoadingError`
 *              - 关闭三路：Esc / `×`（`NueDialog` 原生）· 底部「关闭」按钮；**焦点归还**由触发方
 *                （footer）负责 —— 对话框不持有触发项引用
 *              - 打开按 `taskId`（entityId）加载；关闭即卸载内容并清空本组件状态（`generation`
 *                丢弃在途响应）⇒ 无残留
 *              - `R-10` 硬要求③：打开期间详情页自动刷新（`vo` 换新对象、`taskId` 不变）
 *                **不重挂、不清空**列表 —— 加载只由「打开 / 换任务」触发
 *              - 文案：字段名复用 `conflict-field-labels`（与冲突面板同一份）；框架文案只用
 *                既有 `history.*`（13 键）与 `common.close`，⛔ 不新增键、不裸露内部词
 * @see docs/prds/2026-11-10-audit-log.md（R-10 / AC12 / AC3）
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

/** 来源 → 样式修饰（颜色 + 符号 + 文字三重冗余；类名不含内部值） */
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
                <nue-div class="task-history">
                    <nue-div class="task-history__list">
                        <nue-div
                            v-for="item in items"
                            :key="item.seq ?? item.at"
                            class="task-history__entry"
                            :class="`task-history__entry--${sourceTone(item.source)}`"
                        >
                            <nue-div class="task-history__meta">
                                <nue-text class="task-history__icon" aria-hidden="true">
                                    {{ sourceIcon(item.source) }}
                                </nue-text>
                                <nue-text class="task-history__time">
                                    {{ relativeTime(item.at) }}
                                </nue-text>
                                <nue-text class="task-history__source">
                                    {{ sourceLabel(item.source) }}
                                </nue-text>
                                <nue-text
                                    v-if="actionLabel(item.action)"
                                    class="task-history__action"
                                >
                                    {{ actionLabel(item.action) }}
                                </nue-text>
                            </nue-div>
                            <nue-div
                                v-for="diff in item.fields"
                                :key="diff.field"
                                class="task-history__field"
                            >
                                <nue-text class="task-history__field-name">
                                    {{ fieldLabel(diff.field) }}
                                </nue-text>
                                <nue-text class="task-history__field-values">
                                    <span class="task-history__from">
                                        {{ formatValue(diff.field, diff.from) }}
                                    </span>
                                    <span class="task-history__arrow" aria-hidden="true">→</span>
                                    <span class="task-history__to">
                                        {{ formatValue(diff.field, diff.to) }}
                                    </span>
                                </nue-text>
                            </nue-div>
                        </nue-div>
                    </nue-div>
                    <nue-button
                        v-if="hasMore"
                        class="task-history__more"
                        theme="pure,small"
                        @click="loadMore"
                    >
                        {{ t('history.more') }}
                    </nue-button>
                </nue-div>
            </loading-error>
        </template>
        <template #footer>
            <nue-div flex="1" justify="flex-end">
                <nue-button theme="primary" @click="requestClose">
                    {{ t('common.close') }}
                </nue-button>
            </nue-div>
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
    flex-direction: column;
    align-items: stretch;
    gap: var(--nue-gap-sm);
    width: 100%;
}

.task-history__list {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nue-gap-sm);
    width: 100%;
    /* 查阅型信息：框内滚动，标题与底部按钮常驻 */
    max-height: min(58vh, 26rem);
    overflow: auto;
}

/* C 端形态：卡片式时间线条目（非表格式），点击区 ≥ 40px */
.task-history__entry {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nue-gap-2xs);
    min-height: 40px;
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-radius-sm);
    background-color: var(--nue-primary-color-0);
    box-sizing: border-box;
}

/* 三态可辨：颜色 + 符号 + 文字（「本机 / 云端 / 合并 / 恢复」四色，符号见模板） */
.task-history__entry--self {
    border-left: 3px solid var(--nue-primary-color-500);
}

.task-history__entry--cloud {
    border-left: 3px solid var(--nue-primary-color-400);
}

.task-history__entry--merged {
    border-left: 3px dashed var(--nue-primary-color-400);
}

.task-history__entry--restored {
    border-left: 3px dotted var(--nue-primary-color-600);
}

.task-history__meta {
    align-items: center;
    gap: var(--nue-gap-xs);
    flex-wrap: wrap;
}

.task-history__icon {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
}

.task-history__time {
    font-size: var(--nue-text-xs);
    color: var(--nue-primary-color-600);
}

.task-history__source,
.task-history__action {
    font-size: var(--nue-text-xs);
    padding: 0 var(--nue-gap-2xs);
    border-radius: var(--nue-radius-sm);
    background-color: var(--nue-primary-color-100);
    color: var(--nue-primary-color-800);
}

.task-history__field {
    align-items: baseline;
    gap: var(--nue-gap-xs);
    flex-wrap: wrap;
}

.task-history__field-name {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-800);
    font-weight: 500;
}

.task-history__field-values {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-700);
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    word-break: break-word;
}

.task-history__from {
    color: var(--nue-primary-color-500);
    text-decoration: line-through;
}

.task-history__arrow {
    color: var(--nue-primary-color-400);
}

.task-history__to {
    color: var(--nue-primary-color-900);
}

.task-history__more {
    align-self: flex-start;
    font-size: var(--nue-text-xs);
    color: var(--nue-primary-color-600);
}
</style>