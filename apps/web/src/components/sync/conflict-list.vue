<script setup lang="ts">
/**
 * 冲突列表主体（左栏名称 / 右栏详情）—— 数据面由父级 `ConflictDialog` 经 `ux` 注入（DI 唯一入口）
 *
 * @description T340 · C 端化：面向消费级用户，**不是后台管理台**。
 *              - 左栏**只保留对象名称**（分组）；冲突类型/状态/时间/ID/字段差异**全部进右栏详情**（信息只迁移不丢失）；
 *              - 详情为**卡片 + 分区留白 + 圆角**，非「表头 + 行 + 网格」；条目点击区 ≥40px；
 *              - 文案**去术语**（我的修改 / 云端最新 / 用云端的 / 保留我的修改）；字段名用**可读标签**；
 *              - 三态「颜色 + 符号 + 文字标签」三重冗余（`-80` 图形 / `-90` 文本，实测达标）；
 *              - 技术字段**始终显示**但为**次要样式**（次要色 / 更小字号 / 排在普通字段之后 + 轻分隔）；
 *              - 覆盖类动作给**安全提示**，主按钮「保留我的修改」突出、次按钮弱化。
 *              四态齐备（加载/空/错误/成功）；⛔ 不改恢复动作 / 合并语义 / 计数。
 */
import { computed, onMounted, ref } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import type {
    ConflictFieldDiff,
    ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import type { ConflictUx } from '@/hooks'
import { fieldLabel } from './conflict-field-labels'
import {
    DIFF_LABEL_KEY,
    DIFF_SYMBOL,
    classifyFieldDiff,
    conflictTitleOf,
    formatFieldValue,
    groupConflictItems,
    isLongValue,
    splitTechnicalDiffs,
    type ConflictGroup,
    type FieldDiffKind
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

/** 长值展开态；组折叠态 */
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

const timeOf = (iso: string | undefined): string => {
    if (!iso) return '—'
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const groups = computed<ConflictGroup[]>(() => groupConflictItems(items.value))

/** 组头 = 对象名称（降级链：name/title → entityId → 本地化 kind → 未知对象；不空白/undefined） */
const groupTitle = (group: ConflictGroup): string => {
    const item = group.items[0]!
    return conflictTitleOf(item, kindLabel(item.kind) || t('sync.conflict.unknownObject'))
}

const groupCollapsed = (key: string): boolean => collapsedGroups.value[key] === true

const toggleGroup = (key: string): void => {
    collapsedGroups.value[key] = !groupCollapsed(key)
}

interface DiffRow {
    field: string
    kind: FieldDiffKind
    symbol: string
    label: string
    humanLabel: string
    loserText: string
    currentText: string
}

const toRow = (diff: ConflictFieldDiff): DiffRow => {
    const kind = classifyFieldDiff(diff)
    return {
        field: diff.field,
        kind,
        symbol: DIFF_SYMBOL[kind],
        label: t(DIFF_LABEL_KEY[kind]),
        humanLabel: fieldLabel(diff.field),
        loserText: formatFieldValue(diff.loser),
        currentText: formatFieldValue(diff.current)
    }
}

/** 技术字段**始终显示**，但拆到普通字段之后（次要段落） */
const diffGroups = computed(() => {
    const { normal, technical } = splitTechnicalDiffs(comparison.value?.diffs ?? [])
    return { normal: normal.map(toRow), technical: technical.map(toRow) }
})

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
        <!-- 左栏：只保留对象名称（分组）+ 极简「冲突 N」条目；详情全部在右栏 -->
        <div class="conflict-list__left">
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
                        <span class="conflict-list__group-title">{{ groupTitle(group) }}</span>
                    </button>
                    <ul v-show="!groupCollapsed(group.key)" class="conflict-list__items">
                        <li
                            v-for="(item, index) in group.items"
                            :key="item.id"
                            class="conflict-list__item"
                        >
                            <button
                                class="conflict-list__entry"
                                :class="{ 'is-active': isActive(item) }"
                                :aria-selected="isActive(item)"
                                @click="compare(item)"
                            >
                                {{ t('sync.conflict.entryOrdinal', { index: index + 1 }) }}
                            </button>
                        </li>
                    </ul>
                </section>
            </div>
        </div>

        <!-- 右栏：详情（对象信息 + 差异 + 技术字段 + 安全提示 + 动作） -->
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
                <h3 class="conflict-list__detail-title">{{ t('sync.conflict.detailTitle') }}</h3>

                <!-- 对象信息：左栏移出的信息在此完整承载 -->
                <section class="conflict-list__section">
                    <nue-text size="xs" class="conflict-list__section-title">
                        {{ t('sync.conflict.objectInfo') }}
                    </nue-text>
                    <dl class="conflict-list__meta-list">
                        <div class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaTable') }}</dt>
                            <dd>{{ tableLabel(comparison.table) }}</dd>
                        </div>
                        <div v-if="activeItem" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaKind') }}</dt>
                            <dd>{{ kindLabel(activeItem.kind) }}</dd>
                        </div>
                        <div class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaEntityId') }}</dt>
                            <dd>{{ comparison.entityId }}</dd>
                        </div>
                        <div v-if="activeItem" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaEntryId') }}</dt>
                            <dd>{{ activeItem.id }}</dd>
                        </div>
                        <div v-if="activeItem" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaAt') }}</dt>
                            <dd>{{ timeOf(activeItem.at) }}</dd>
                        </div>
                        <div v-if="activeItem?.winnerUpdatedAt" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaServerTime') }}</dt>
                            <dd>{{ timeOf(activeItem.winnerUpdatedAt) }}</dd>
                        </div>
                        <div v-if="activeItem?.loserUpdatedAt" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaLocalTime') }}</dt>
                            <dd>{{ timeOf(activeItem.loserUpdatedAt) }}</dd>
                        </div>
                    </dl>
                </section>

                <!-- 差异详情：逐字段卡片（无表头/网格） -->
                <section class="conflict-list__section">
                    <nue-text size="xs" class="conflict-list__section-title">
                        {{ t('sync.conflict.compareTitle') }}
                    </nue-text>
                    <ul class="conflict-list__diffs">
                        <li
                            v-for="row in diffGroups.normal"
                            :key="row.field"
                            class="conflict-list__diff"
                            :class="`is-${row.kind}`"
                        >
                            <div class="conflict-list__diff-top">
                                <span class="conflict-list__symbol" :class="`is-${row.kind}`">
                                    {{ row.symbol }}
                                </span>
                                <span class="conflict-list__field-name">{{ row.humanLabel }}</span>
                                <span class="conflict-list__state-label" :class="`is-${row.kind}`">
                                    {{ row.label }}
                                </span>
                            </div>
                            <div class="conflict-list__value-row">
                                <span class="conflict-list__value-source">
                                    {{ t('sync.conflict.loserLabel') }}
                                </span>
                                <nue-text size="xs" class="conflict-list__value is-loser">
                                    <span
                                        class="conflict-list__text"
                                        :class="{
                                            'is-truncated': isTruncated(
                                                row.loserText,
                                                row.field,
                                                'loser'
                                            )
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
                            </div>
                            <div class="conflict-list__value-row">
                                <span class="conflict-list__value-source">
                                    {{ t('sync.conflict.currentLabel') }}
                                </span>
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
                            </div>
                        </li>

                        <!-- 技术字段：始终显示，但次要段落（轻分隔 + 次要色 / 更小字号） -->
                        <template v-if="diffGroups.technical.length > 0">
                            <li class="conflict-list__diff-sep">
                                {{ t('sync.conflict.technicalSection') }}
                            </li>
                            <li
                                v-for="row in diffGroups.technical"
                                :key="row.field"
                                class="conflict-list__diff is-technical"
                                :class="`is-${row.kind}`"
                            >
                                <div class="conflict-list__diff-top">
                                    <span class="conflict-list__symbol" :class="`is-${row.kind}`">
                                        {{ row.symbol }}
                                    </span>
                                    <span class="conflict-list__field-name">
                                        {{ row.humanLabel }}
                                    </span>
                                </div>
                                <div class="conflict-list__value-row">
                                    <span class="conflict-list__value-source">
                                        {{ t('sync.conflict.loserLabel') }}
                                    </span>
                                    <nue-text size="xs" class="conflict-list__value is-loser">
                                        <span class="conflict-list__text">{{ row.loserText }}</span>
                                    </nue-text>
                                </div>
                                <div class="conflict-list__value-row">
                                    <span class="conflict-list__value-source">
                                        {{ t('sync.conflict.currentLabel') }}
                                    </span>
                                    <nue-text size="xs" class="conflict-list__value is-current">
                                        <span class="conflict-list__text">{{
                                            row.currentText
                                        }}</span>
                                    </nue-text>
                                </div>
                            </li>
                        </template>
                    </ul>
                </section>

                <nue-text v-if="retryFailed" size="xs" color="var(--nue-error-color-90)">
                    {{ t('sync.conflict.retryFailed') }}
                </nue-text>
                <!-- 覆盖类动作的安全提示 -->
                <nue-text
                    size="xs"
                    color="var(--nue-secondary-text-color)"
                    class="conflict-list__safety"
                >
                    {{ t('sync.conflict.safetyHint') }}
                </nue-text>
                <div class="conflict-list__actions">
                    <nue-button theme="primary,small" @click="runRetryLocal">
                        {{ t('sync.conflict.retryLocal') }}
                    </nue-button>
                    <nue-button theme="small,ghost" @click="runKeepServer">
                        {{ t('sync.conflict.keepServer') }}
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
/* T340：左右分栏（阈值 900px，窄窗堆叠见下方 @media） */
.conflict-list {
    display: flex;
    flex-direction: row;
    gap: var(--nue-gap-df);
    min-height: 0;
    flex: 1;
}

/* 左栏与右栏之间的竖向 1px 分隔（既有 border 色 token） */
.conflict-list__left {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    flex: 0 1 clamp(200px, 26%, 320px);
    min-height: 0;
    overflow-y: auto;
    padding-right: var(--nue-gap-df);
    border-right: 1px solid var(--nue-border-color);
}

.conflict-list__right {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
}

/* 窄窗堆叠：竖分隔改为**横向**分隔（复用左栏下边框，语义一致且不新增控件） */
@media (max-width: 899.98px) {
    .conflict-list {
        flex-direction: column;
    }

    .conflict-list__left {
        flex: none;
        max-height: 30vh;
        padding-right: 0;
        padding-bottom: var(--nue-gap-xs);
        border-right: none;
        border-bottom: 1px solid var(--nue-border-color);
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

/* C 端：点击区 ≥40px + 圆角 + hover */
.conflict-list__group-head {
    display: flex;
    align-items: center;
    min-height: 40px;
    width: 100%;
    padding: 0 var(--nue-gap-xs);
    border: none;
    border-radius: var(--nue-radius-lg);
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__group-head:hover {
    background-color: var(--nue-primary-color-100);
}

.conflict-list__items,
.conflict-list__diffs {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    margin: 0;
    padding: 0;
    list-style: none;
}

.conflict-list__item {
    display: flex;
    flex-direction: column;
}

.conflict-list__entry {
    display: flex;
    align-items: center;
    min-height: 40px;
    width: 100%;
    padding: 0 var(--nue-gap-xs);
    border: none;
    border-left: 3px solid transparent;
    border-radius: var(--nue-radius-lg);
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-xs);
}

.conflict-list__entry:hover {
    background-color: var(--nue-primary-color-100);
}

.conflict-list__entry.is-active {
    border-left-color: var(--nue-primary-color-600);
    background-color: var(--nue-primary-color-100);
    font-weight: var(--nue-font-weight-medium, 500);
}

/* 详情：分区留白（非表头/网格） */
.conflict-list__detail-title {
    margin: 0;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-md);
    font-weight: 600;
}

.conflict-list__section {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

.conflict-list__section-title {
    color: var(--nue-secondary-text-color);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__meta-list {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin: 0;
    padding: var(--nue-gap-xs) var(--nue-gap-sm);
    border-radius: var(--nue-radius-lg);
    background-color: var(--nue-primary-color-100);
}

.conflict-list__meta-row {
    display: grid;
    grid-template-columns: minmax(88px, auto) minmax(0, 1fr);
    gap: var(--nue-gap-xs);
    align-items: baseline;
}

.conflict-list__meta-row dt {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

.conflict-list__meta-row dd {
    margin: 0;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-xs);
    overflow-wrap: anywhere;
}

/* 逐字段卡片：圆角 + 留白 + 状态色条（无表头/网格） */
.conflict-list__diff {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    padding: var(--nue-gap-xs) var(--nue-gap-sm);
    border-radius: var(--nue-radius-lg);
    border-left: 3px solid transparent;
    background-color: var(--nue-primary-color-100);
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

.conflict-list__diff-top {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--nue-gap-2xs);
    min-width: 0;
}

.conflict-list__field-name {
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm);
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

/* 值行：来源标签 + 值（逐行，避免表头/网格） */
.conflict-list__value-row {
    display: grid;
    grid-template-columns: minmax(64px, auto) minmax(0, 1fr);
    gap: var(--nue-gap-xs);
    align-items: baseline;
}

.conflict-list__value-source {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

.conflict-list__value {
    display: flex;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    min-width: 0;
}

/* 来源层级：我的修改 = secondary，云端最新 = primary + medium */
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

/* 技术字段：始终显示但次要（更小字号 + 次要色；保留状态色条以不丢三态） */
.conflict-list__diff-sep {
    padding-top: var(--nue-gap-xs);
    border-top: 1px solid var(--nue-border-color);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

.conflict-list__diff.is-technical {
    background-color: transparent;
    padding: var(--nue-gap-2xs) var(--nue-gap-sm);
}

.conflict-list__diff.is-technical .conflict-list__field-name,
.conflict-list__diff.is-technical .conflict-list__value,
.conflict-list__diff.is-technical .conflict-list__value.is-current {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
    font-weight: 400;
}

.conflict-list__safety {
    color: var(--nue-secondary-text-color);
}

.conflict-list__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nue-gap-sm);
    position: sticky;
    bottom: 0;
    padding: var(--nue-gap-xs) 0;
    background-color: var(--nue-primary-color-0);
}
</style>