<script setup lang="ts">
/**
 * 冲突列表（T165 / W3 · ADR §9.2.1）—— 状态面板「冲突 N」入口展开后的列表/只读对比/恢复动作
 *
 * @description 数据面经 `useConflictUx`（DI 唯一入口）；本组件只做呈现与交互。
 *              四态齐备（加载/空/错误/成功）；折叠提示按 `foldedReason` 区分
 *              「已达上限」(`limit`) 与「更早记录已折叠」(`evicted`)。
 */
import { computed, onMounted } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import type { ConflictListItem } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { useConflictUx } from '@/hooks'

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

const titleOf = (item: ConflictListItem): string => {
    const loser = item.loser ?? {}
    const title = loser.name ?? loser.title
    return typeof title === 'string' && title ? title : item.entityId
}

const timeOf = (iso: string): string => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

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
        <ul v-else class="conflict-list__items">
            <li v-for="item in items" :key="item.id" class="conflict-list__item">
                <nue-button
                    class="conflict-list__entry"
                    :class="{ 'is-active': isActive(item) }"
                    theme="pure,small"
                    @click="compare(item)"
                >
                    {{ tableLabel(item.table) }} · {{ titleOf(item) }}
                </nue-button>
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ kindLabel(item.kind) }} · {{ timeOf(item.at) }}
                </nue-text>
            </li>
        </ul>

        <!-- 只读对比：败方快照 vs 本地当前行（字段级差异仅展示，不自动合并） -->
        <div v-if="comparison" class="conflict-list__compare">
            <nue-text size="xs" class="conflict-list__compare-title">
                {{ t('sync.conflict.compareTitle') }}
            </nue-text>
            <div class="conflict-list__diff-head">
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('sync.conflict.loserLabel') }}
                </nue-text>
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('sync.conflict.currentLabel') }}
                </nue-text>
            </div>
            <ul class="conflict-list__diffs">
                <li v-for="diff in comparison.diffs" :key="diff.field" class="conflict-list__diff">
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ diff.field }}
                    </nue-text>
                    <nue-text size="xs">{{ formatValue(diff.loser) }}</nue-text>
                    <nue-text size="xs">{{ formatValue(diff.current) }}</nue-text>
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

.conflict-list__compare-title {
    color: var(--nue-primary-text-color);
}

.conflict-list__diff-head,
.conflict-list__diff {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--nue-gap-2xs);
    align-items: start;
}

.conflict-list__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nue-gap-2xs);
}
</style>