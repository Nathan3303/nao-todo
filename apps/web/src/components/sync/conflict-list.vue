<script setup lang="ts">
/**
 * 冲突列表主体（左栏记录 / 右栏 diff）—— 数据面由父级 `ConflictDialog` 经 `ux` 注入（DI 唯一入口）
 *
 * @description T338：左栏 = 按对象分组的冲突记录（可滚动、选中高亮）；右栏 = 选中条目 diff
 *              （仅差异字段 · 三态「颜色 + 符号 + 文字标签」三重冗余 · 技术字段开关 · 长值展开）。
 *              四态齐备（加载/空/错误/成功）；⛔ 不改恢复动作 / 合并语义 / 计数。
 */
import { computed, onMounted, ref } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import type { ConflictListItem } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import type { ConflictUx } from '@/hooks'
import {
    DIFF_LABEL_KEY,
    DIFF_SYMBOL,
    classifyFieldDiff,
    conflictTitleOf,
    formatFieldValue,
    groupConflictItems,
    isLongValue,
    visibleDiffs,
    type ConflictGroup
} from './conflict-diff'

defineOptions({ name: 'ConflictList' })

const props = defineProps<{ ux: ConflictUx }>()

const {
    items,
    folded,
    foldedReason,
    loading,
    error,
    comparison,
    retryFailed,
    refresh,
    compare,
    keepServer,
    retryLocal,
    closeComparison
} = props.ux

onMounted(() => {
    void refresh()
})

/** 技术字段开关（默认隐藏 `updatedAt`/`revision` 等）；长值展开态；组折叠态 */
const showTechnical = ref(false)
const collapsedGroups = ref<Record<string, boolean>>({})
const expandedValues = ref<Record<string, boolean>>({})

const TABLE_KEYS: Record<string, LocaleKey> = {
    projects: 'sync.conflict.table.projects',
    tags: 'sync.conflict.table.tags',
    tasks: 'sync.conflict.table.tasks',
    taskCheckItems: 'sync.conflict.table.taskCheckItems',
    taskComments: 'sync.conflict.table.taskComments',
    pomodoros: 'sync.conflict.table.pomodoros',
    pomodoroRecords: 'sync.conflict.table.pomodoroRecords'
}

const KIND_KEYS: Record<string, LocaleKey> = {
    'remote-wins': 'sync.conflict.kind.remote-wins',
    'push-noop': 'sync.conflict.kind.push-noop',
    stale: 'sync.conflict.kind.stale',
    conflict: 'sync.conflict.kind.conflict',
    skipped: 'sync.conflict.kind.skipped'
}

const tableLabel = (table: string): string => (TABLE_KEYS[table] ? t(TABLE_KEYS[table]!) : table)

const kindLabel = (kind: string): string => (KIND_KEYS[kind] ? t(KIND_KEYS[kind]!) : kind)

const timeOf = (iso: string): string => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const groups = computed<ConflictGroup[]>(() => groupConflictItems(items.value))

const groupTitle = (group: ConflictGroup): string => {
    const item = group.items[0]!
    // 降级链：可读名 → entityId → 本地化 kind 标签 → 「未知对象」（不得空白/undefined）
    return conflictTitleOf(item, kindLabel(item.kind) || t('sync.conflict.unknownObject'))
}

const groupCollapsed = (key: string): boolean => collapsedGroups.value[key] === true

const toggleGroup = (key: string): void => {
    collapsedGroups.value[key] = !groupCollapsed(key)
}

/** 可见差异（默认隐藏技术字段）+ 三态分类 + 值格式化 + 本地化标签 */
const diffRows = computed(() =>
    visibleDiffs(comparison.value?.diffs ?? [], showTechnical.value).map((diff) => {
        const kind = classifyFieldDiff(diff)
        return {
            field: diff.field,
            kind,
            symbol: DIFF_SYMBOL[kind],
            label: t(DIFF_LABEL_KEY[kind]),
            loserText: formatFieldValue(diff.loser),
            currentText: formatFieldValue(diff.current)
        }
    })
)

const valueKey = (field: string, side: 'loser' | 'current'): string => `${field}:${side}`

const valueExpanded = (field: string, side: 'loser' | 'current'): boolean =>
    expandedValues.value[valueKey(field, side)] === true

const toggleValue = (field: string, side: 'loser' | 'current'): void => {
    const key = valueKey(field, side)
    expandedValues.value[key] = !valueExpanded(field, side)
}

const isTruncated = (text: string, field: string, side: 'loser' | 'current'): boolean =>
    isLongValue(text) && !valueExpanded(field, side)

const isActive = (item: ConflictListItem): boolean =>
    comparison.value?.table === item.table && comparison.value?.entityId === item.entityId

const activeItem = computed<ConflictListItem | null>(
    () => items.value.find((item) => isActive(item)) ?? null
)

const runKeepServer = (): void => {
    if (activeItem.value) void keepServer(activeItem.value)
}

const runRetryLocal = (): void => {
    if (activeItem.value) void retryLocal(activeItem.value)
}
</script>

<template>
    <div class="conflict-list">
        <!-- 左栏：冲突记录（按对象分组 / 四态） -->
        <div class="conflict-list__left">
            <!-- 折叠提示：两文案区分 limit / evicted（R-15） -->
            <nue-text
                v-if="folded"
                class="conflict-list__fold"
                size="xs"
                color="var(--nue-warning-color-90)"
            >
                {{
                    foldedReason === 'evicted'
                        ? t('sync.conflict.foldEvicted')
                        : t('sync.conflict.foldLimit')
                }}
            </nue-text>

            <nue-text
                v-if="loading"
                size="xs"
                color="var(--nue-secondary-text-color)"
                class="conflict-list__state"
            >
                {{ t('sync.conflict.loading') }}
            </nue-text>
            <nue-text
                v-else-if="error"
                size="xs"
                color="var(--nue-error-color-90)"
                class="conflict-list__state"
            >
                {{ error }}
            </nue-text>
            <nue-text
                v-else-if="items.length === 0"
                size="xs"
                color="var(--nue-secondary-text-color)"
                class="conflict-list__state"
            >
                {{ t('sync.conflict.empty') }}
            </nue-text>

            <div v-else class="conflict-list__groups">
                <section v-for="group in groups" :key="group.key" class="conflict-list__group">
                    <button
                        class="conflict-list__group-head"
                        :aria-expanded="!groupCollapsed(group.key)"
                        @click="toggleGroup(group.key)"
                    >
                        <span class="conflict-list__group-title">
                            {{ tableLabel(group.table) }} · {{ groupTitle(group) }}
                        </span>
                        <span class="conflict-list__group-count">
                            {{ t('sync.conflict.groupCount', { count: group.items.length }) }}
                        </span>
                    </button>
                    <ul v-show="!groupCollapsed(group.key)" class="conflict-list__items">
                        <li v-for="item in group.items" :key="item.id" class="conflict-list__item">
                            <button
                                class="conflict-list__entry"
                                :class="{ 'is-active': isActive(item) }"
                                :aria-selected="isActive(item)"
                                @click="compare(item)"
                            >
                                <span>{{ kindLabel(item.kind) }}</span>
                                <span class="conflict-list__entry-time">{{ timeOf(item.at) }}</span>
                            </button>
                        </li>
                    </ul>
                </section>
            </div>
        </div>

        <!-- 右栏：选中条目的 diff（未选中 ⇒ 提示） -->
        <div class="conflict-list__right">
            <nue-text
                v-if="!comparison"
                size="xs"
                color="var(--nue-secondary-text-color)"
                class="conflict-list__state"
            >
                {{ t('sync.conflict.selectHint') }}
            </nue-text>
            <template v-else>
                <div class="conflict-list__compare-bar">
                    <nue-text size="xs" class="conflict-list__compare-title">
                        {{ t('sync.conflict.compareTitle') }}
                    </nue-text>
                    <nue-button
                        class="conflict-list__tech-toggle"
                        :class="{ 'is-on': showTechnical }"
                        theme="pure,small"
                        @click="showTechnical = !showTechnical"
                    >
                        {{ t('sync.conflict.showTechnical') }}
                    </nue-button>
                </div>
                <div class="conflict-list__diff-head">
                    <span class="conflict-list__diff-head-spacer" />
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ t('sync.conflict.loserLabel') }}
                    </nue-text>
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ t('sync.conflict.currentLabel') }}
                    </nue-text>
                </div>
                <ul class="conflict-list__diffs">
                    <li
                        v-for="row in diffRows"
                        :key="row.field"
                        class="conflict-list__diff"
                        :class="`is-${row.kind}`"
                    >
                        <span class="conflict-list__field">
                            <span class="conflict-list__symbol" :class="`is-${row.kind}`">
                                {{ row.symbol }}
                            </span>
                            <span class="conflict-list__field-name">{{ row.field }}</span>
                            <span class="conflict-list__state-label" :class="`is-${row.kind}`">
                                {{ row.label }}
                            </span>
                        </span>
                        <nue-text size="xs" class="conflict-list__value is-loser">
                            <span
                                class="conflict-list__text"
                                :class="{
                                    'is-truncated': isTruncated(row.loserText, row.field, 'loser')
                                }"
                                >{{ row.loserText }}</span
                            >
                            <button
                                v-if="isLongValue(row.loserText)"
                                class="conflict-list__value-toggle"
                                @click="toggleValue(row.field, 'loser')"
                            >
                                {{
                                    valueExpanded(row.field, 'loser')
                                        ? t('sync.conflict.collapse')
                                        : t('sync.conflict.expand')
                                }}
                            </button>
                        </nue-text>
                        <nue-text size="xs" class="conflict-list__value is-current">
                            <span
                                class="conflict-list__text"
                                :class="{
                                    'is-truncated': isTruncated(
                                        row.currentText,
                                        row.field,
                                        'current'
                                    )
                                }"
                                >{{ row.currentText }}</span
                            >
                            <button
                                v-if="isLongValue(row.currentText)"
                                class="conflict-list__value-toggle"
                                @click="toggleValue(row.field, 'current')"
                            >
                                {{
                                    valueExpanded(row.field, 'current')
                                        ? t('sync.conflict.collapse')
                                        : t('sync.conflict.expand')
                                }}
                            </button>
                        </nue-text>
                    </li>
                </ul>
                <nue-text v-if="retryFailed" size="xs" color="var(--nue-error-color-90)">
                    {{ t('sync.conflict.retryFailed') }}
                </nue-text>
                <div class="conflict-list__actions">
                    <nue-button theme="pure,small" @click="runKeepServer">
                        {{ t('sync.conflict.keepServer') }}
                    </nue-button>
                    <nue-button theme="pure,small" @click="runRetryLocal">
                        {{ t('sync.conflict.retryLocal') }}
                    </nue-button>
                    <nue-button theme="pure,small" @click="closeComparison">
                        {{ t('sync.conflict.close') }}
                    </nue-button>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
/* T338：左右分栏（阈值 900px，窄窗堆叠见下方 @media） */
.conflict-list {
    display: flex;
    flex-direction: row;
    gap: var(--nue-gap-sm);
    min-height: 0;
    flex: 1;
}

.conflict-list__left {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    flex: 0 1 clamp(240px, 30%, 360px);
    min-height: 0;
    overflow-y: auto;
}

.conflict-list__right {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
}

@media (max-width: 899.98px) {
    .conflict-list {
        flex-direction: column;
    }

    .conflict-list__left {
        flex: none;
        max-height: 30vh;
        border-bottom: 1px solid var(--nue-border-color);
        padding-bottom: var(--nue-gap-xs);
    }
}

.conflict-list__fold {
    color: var(--nue-warning-color-90);
}

.conflict-list__state {
    color: var(--nue-secondary-text-color);
}

.conflict-list__groups {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}

.conflict-list__group {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
}

.conflict-list__group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--nue-gap-xs);
    width: 100%;
    padding: 6px 0;
    border: none;
    border-bottom: 1px solid var(--nue-border-color);
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__group-count {
    flex: none;
    font-size: var(--nue-text-xs);
    color: var(--nue-secondary-text-color);
    font-weight: 400;
}

.conflict-list__items,
.conflict-list__diffs {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin: 0;
    padding: 0;
    list-style: none;
}

.conflict-list__diffs {
    gap: var(--nue-gap-xs);
}

.conflict-list__item {
    display: flex;
    flex-direction: column;
}

.conflict-list__entry {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--nue-gap-xs);
    width: 100%;
    padding: var(--nue-gap-2xs) var(--nue-gap-xs);
    border: none;
    border-left: 3px solid transparent;
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-xs);
}

.conflict-list__entry.is-active {
    border-left-color: var(--nue-primary-color-600);
    background-color: var(--nue-primary-color-100);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__entry-time {
    flex: none;
    color: var(--nue-secondary-text-color);
}

.conflict-list__compare-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-xs);
}

.conflict-list__compare-title {
    color: var(--nue-primary-text-color);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__tech-toggle {
    flex: none;
}

.conflict-list__tech-toggle.is-on {
    color: var(--nue-primary-color-600);
}

.conflict-list__diff-head,
.conflict-list__diff {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--nue-gap-xs);
    align-items: start;
}

/* T338：三态高亮 —— 颜色（-80 图形）+ 符号 + 文字标签（-90 文本）三重冗余 */
.conflict-list__diff {
    min-height: 24px;
    padding-left: var(--nue-gap-xs);
    border-left: 3px solid transparent;
}

.conflict-list__diff.is-added {
    border-left-color: var(--nue-success-color-80);
}

.conflict-list__diff.is-removed {
    border-left-color: var(--nue-error-color-80);
}

.conflict-list__diff.is-changed {
    border-left-color: var(--nue-warning-color-80);
}

.conflict-list__field {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--nue-gap-2xs);
    min-width: 0;
}

.conflict-list__field-name {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    font-weight: var(--nue-font-weight-medium, 500);
    overflow-wrap: anywhere;
}

.conflict-list__symbol {
    flex: none;
    font-size: var(--nue-text-xs);
    font-weight: 700;
}

.conflict-list__symbol.is-added {
    color: var(--nue-success-color-80);
}

.conflict-list__symbol.is-removed {
    color: var(--nue-error-color-80);
}

.conflict-list__symbol.is-changed {
    color: var(--nue-warning-color-80);
}

/* 文字标签：小文本须 ≥4.5:1 ⇒ 用 -90 级（实测 4.95 / 6.67 / 8.97） */
.conflict-list__state-label {
    font-size: var(--nue-text-2xs);
    font-weight: 500;
}

.conflict-list__state-label.is-added {
    color: var(--nue-success-color-90);
}

.conflict-list__state-label.is-removed {
    color: var(--nue-error-color-90);
}

.conflict-list__state-label.is-changed {
    color: var(--nue-warning-color-90);
}

.conflict-list__value {
    display: flex;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    min-width: 0;
}

/* 来源层级：败方 = secondary，服务端当前 = primary + medium（可读性不依赖状态色） */
.conflict-list__value.is-loser {
    color: var(--nue-secondary-text-color);
}

.conflict-list__value.is-current {
    color: var(--nue-primary-text-color);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__text {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    line-height: 1.6;
}

.conflict-list__text.is-truncated {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.conflict-list__value-toggle {
    flex: none;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--nue-primary-color-600);
    font-size: var(--nue-text-2xs);
}

.conflict-list__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nue-gap-xs);
    position: sticky;
    bottom: 0;
    padding-top: var(--nue-gap-xs);
    background-color: var(--nue-primary-color-0);
}
</style>