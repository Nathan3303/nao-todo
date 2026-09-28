<script setup lang="ts">
/**
 * 冲突列表（T165 / W3 · ADR §9.2.1；T332 展示层优化）—— 状态面板「冲突 N」入口展开后的列表/只读对比/恢复动作
 *
 * @description 数据面经 `useConflictUx`（DI 唯一入口）；本组件只做呈现与交互。
 *              四态齐备（加载/空/错误/成功）；折叠提示按 `foldedReason` 区分
 *              「已达上限」(`limit`) 与「更早记录已折叠」(`evicted`)。
 *              **T332**：按对象分组 · 三态（增/删/改）高亮 · 技术字段默认隐藏可展开 ·
 *              长值截断可展开 · 双方来源标注。⛔ 不改恢复动作 / 合并语义 / 计数。
 */
import { computed, onMounted, ref } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import type { ConflictListItem } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { useConflictUx } from '@/hooks'
import {
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
} = useConflictUx()

onMounted(() => {
    void refresh()
})

/** T332：技术字段开关（默认隐藏 `updatedAt`/`revision` 等）；长值展开态 */
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

/** T332：列表按对象分组（同 `table:entityId` 归一组）；标题取不到时优雅降级 */
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

/** T332：可见差异（默认隐藏技术字段）+ 三态分类 + 值格式化 */
const diffRows = computed(() =>
    visibleDiffs(comparison.value?.diffs ?? [], showTechnical.value).map((diff) => {
        const kind = classifyFieldDiff(diff)
        return {
            field: diff.field,
            kind,
            symbol: DIFF_SYMBOL[kind],
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

/** 长值且未展开 ⇒ 截断 */
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
        <!-- 折叠提示：两文案区分 limit / evicted（R-15） -->
        <nue-text
            v-if="folded"
            class="conflict-list__fold"
            size="xs"
            color="var(--nue-warning-color-60)"
        >
            {{
                foldedReason === 'evicted'
                    ? t('sync.conflict.foldEvicted')
                    : t('sync.conflict.foldLimit')
            }}
        </nue-text>

        <!-- 四态：加载 / 错误 / 空 / 成功 -->
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
            color="var(--nue-error-color-60)"
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

        <!-- T332：按对象分组（同一实体的多条冲突归一组；默认展开） -->
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
                        <nue-button
                            class="conflict-list__entry"
                            :class="{ 'is-active': isActive(item) }"
                            theme="pure,small"
                            @click="compare(item)"
                        >
                            {{ kindLabel(item.kind) }} · {{ timeOf(item.at) }}
                        </nue-button>
                    </li>
                </ul>
            </section>
        </div>

        <!-- 只读对比：我的一侧 vs 服务端当前（字段级差异仅展示，不自动合并） -->
        <div v-if="comparison" class="conflict-list__compare">
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
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ row.field }}
                    </nue-text>
                    <nue-text size="xs" class="conflict-list__value">
                        <span class="conflict-list__symbol" :class="`is-${row.kind}`">
                            {{ row.symbol }}
                        </span>
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
                    <nue-text size="xs" class="conflict-list__value">
                        <span class="conflict-list__symbol" :class="`is-${row.kind}`">
                            {{ row.symbol }}
                        </span>
                        <span
                            class="conflict-list__text"
                            :class="{
                                'is-truncated': isTruncated(row.currentText, row.field, 'current')
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
            <nue-text v-if="retryFailed" size="xs" color="var(--nue-error-color-60)">
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
        </div>
    </div>
</template>

<style scoped>
.conflict-list {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    max-height: 40vh;
    overflow-y: auto;
}

.conflict-list__fold {
    color: var(--nue-warning-color-60);
}

.conflict-list__state {
    color: var(--nue-secondary-text-color);
}

.conflict-list__groups {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
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
    gap: var(--nue-gap-2xs);
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--nue-primary-text-color);
}

.conflict-list__group-count {
    flex: none;
    font-size: var(--nue-font-size-xs, 12px);
    color: var(--nue-secondary-text-color);
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

.conflict-list__item {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
}

.conflict-list__entry.is-active {
    color: var(--nue-primary-color-600);
}

.conflict-list__compare {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    border-top: 1px solid var(--nue-border-color);
    padding-top: var(--nue-gap-2xs);
}

.conflict-list__compare-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-2xs);
}

.conflict-list__compare-title {
    color: var(--nue-primary-text-color);
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
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--nue-gap-2xs);
    align-items: start;
}

/* T332：三态高亮 —— 语义色 + 符号双承载（左侧强调条，不整行染色） */
.conflict-list__diff {
    padding-left: var(--nue-gap-2xs);
    border-left: 2px solid transparent;
}

.conflict-list__diff.is-added {
    border-left-color: var(--nue-success-color-60);
}

.conflict-list__diff.is-removed {
    border-left-color: var(--nue-error-color-60);
}

.conflict-list__diff.is-changed {
    border-left-color: var(--nue-warning-color-60);
}

.conflict-list__value {
    display: flex;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    min-width: 0;
}

.conflict-list__symbol {
    flex: none;
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__symbol.is-added {
    color: var(--nue-success-color-60);
}

.conflict-list__symbol.is-removed {
    color: var(--nue-error-color-60);
}

.conflict-list__symbol.is-changed {
    color: var(--nue-warning-color-60);
}

/* T332：长值换行可读 + 未展开时单行截断（点击「展开」看全文） */
.conflict-list__text {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
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
    font-size: var(--nue-font-size-xs, 12px);
}

.conflict-list__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nue-gap-2xs);
}
</style>