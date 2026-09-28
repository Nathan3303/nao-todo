<script setup lang="ts">
/**
 * 冲突列表主体（左栏名称 / 右栏详情）—— 数据面由父级 `ConflictDialog` 经 `ux` 注入（DI 唯一入口）
 *
 * @description T340 · C 端化：面向消费级用户，**不是后台管理台**。
 *              - 左栏**只保留对象名称**（分组）；冲突类型/状态/时间/ID/字段差异**全部进右栏详情**（信息只迁移不丢失）；
 *              - 详情为**卡片 + 分区留白 + 圆角**，非「表头 + 行 + 网格」；条目点击区 ≥40px；
 *              - 文案**去术语**（我的修改 / 云端最新 / 用云端的 / 保留我的修改）；字段名用**可读标签**；
 *              - 三态「颜色 + 符号 + 文字标签」三重冗余（对比度按**卡片真实底色**实测：正文/小文本 ≥4.5、
 *                图形（色条）≥3；绿色系小文本/符号用 `-100`、红/橙文本用 `-90`）；
 *              - 技术字段**始终显示**但为**次要样式**（次要色 / 更小字号 / 排在普通字段之后 + 轻分隔）；
 *              - 覆盖类动作给**安全提示**，主按钮「保留我的修改」突出、次按钮弱化。
 *              四态齐备（加载/空/错误/成功）；⛔ 不改恢复动作 / 合并语义 / 计数。
 */
import { computed, onMounted, ref } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
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

/** T347：底部「关闭」= 关闭对话框（父级监听后收起 modal） */
const emit = defineEmits<{ close: [] }>()

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
    retryLocal
} = props.ux

onMounted(() => {
    void refresh()
})

/** 长值展开态 */
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

/** 选中对象（按实体判定 ⇒ 同一对象仅一行高亮，避免「全 active」） */
const isGroupActive = (group: ConflictGroup): boolean =>
    comparison.value?.table === group.table && comparison.value?.entityId === group.entityId

/** 点击对象行 ⇒ 直接展示该对象的最新冲突详情（`compareConflict` 亦取最新条目） */
const selectGroup = (group: ConflictGroup): void => {
    const item = group.items[group.items.length - 1]
    if (item) void compare(item)
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

/** 是否有字段差异（无 ⇒ 走 LoadingError 空态） */
const hasFieldDiff = computed(
    () => diffGroups.value.normal.length + diffGroups.value.technical.length > 0
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

/** 右侧「对象信息」取该实体的最新条目（与 `compareConflict` 的最新条目同口径） */
const activeItem = computed<ConflictListItem | null>(() => {
    const current = comparison.value
    if (!current) return null
    return (
        [...items.value]
            .reverse()
            .find((item) => item.table === current.table && item.entityId === current.entityId) ??
        null
    )
})

/** T346：选中实体的**全部**记录（用于「全部类型 + 记录条数」⇒ 信息不丢失） */
const activeItems = computed<ConflictListItem[]>(() => {
    const current = comparison.value
    if (!current) return []
    return items.value.filter(
        (item) => item.table === current.table && item.entityId === current.entityId
    )
})

/** 该对象的全部冲突类型（去重、按出现顺序）——避免「只显示最新 kind」丢信息 */
const activeKinds = computed<string[]>(() => {
    const kinds: string[] = []
    for (const item of activeItems.value) {
        const label = kindLabel(item.kind)
        if (!kinds.includes(label)) kinds.push(label)
    }
    return kinds
})

const runKeepServer = (): void => {
    if (activeItem.value) void keepServer(activeItem.value)
}

const runRetryLocal = (): void => {
    if (activeItem.value) void retryLocal(activeItem.value)
}
</script>

<template>
    <div class="conflict-list">
        <!-- 左栏：对象名称列表（一行一对象）；点击行 ⇒ 右栏展示该对象冲突详情（三态用 LoadingError） -->
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
            <loading-error
                class="conflict-list__loading-error"
                :loading="loading"
                :loading-message="t('sync.conflict.loading')"
                :error="!!error"
                :error-message="t('sync.conflict.loadFailed')"
                :empty="!loading && !error && items.length === 0"
                :empty-message="t('sync.conflict.empty')"
                :empty-image-src="assetUrl('/images/notaskhere.webp')"
            >
                <template #error>
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ t('sync.conflict.loadFailed') }}
                    </nue-text>
                    <nue-button theme="primary,small" @click="refresh">
                        {{ t('common.retry') }}
                    </nue-button>
                </template>
                <ul class="conflict-list__groups">
                    <li v-for="group in groups" :key="group.key">
                        <button
                            class="conflict-list__entry"
                            :class="{ 'is-active': isGroupActive(group) }"
                            :aria-selected="isGroupActive(group)"
                            @click="selectGroup(group)"
                        >
                            {{ groupTitle(group) }}
                        </button>
                    </li>
                </ul>
            </loading-error>
        </div>

        <!-- 右栏：详情（对象信息 + 差异 + 技术字段 + 安全提示 + 动作） -->
        <div class="conflict-list__right">
            <loading-error
                v-if="!comparison"
                class="conflict-list__loading-error"
                :loading="false"
                :error="false"
                :empty="true"
                :empty-message="t('sync.conflict.selectHint')"
                :empty-image-src="assetUrl('/images/todo.webp')"
            />
            <template v-else>
                <nue-text tag="h4">
                    {{ t('sync.conflict.detailTitle') }}
                </nue-text>

                <!-- 对象信息：左栏移出的信息在此完整承载 -->
                <nue-div vertical gap="var(--nue-gap-xs)">
                    <nue-text size="xs" class="conflict-list__section-title">
                        {{ t('sync.conflict.objectInfo') }}
                    </nue-text>
                    <dl class="conflict-list__meta-list">
                        <div class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaTable') }}</dt>
                            <dd>{{ tableLabel(comparison.table) }}</dd>
                        </div>
                        <div v-if="activeKinds.length" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaKind') }}</dt>
                            <dd>{{ activeKinds.join('、') }}</dd>
                        </div>
                        <div v-if="activeItems.length" class="conflict-list__meta-row">
                            <dt>{{ t('sync.conflict.metaRecordCount') }}</dt>
                            <dd>{{ activeItems.length }}</dd>
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
                </nue-div>

                <!-- 差异详情：逐字段卡片（无表头/网格）；无字段差异 ⇒ LoadingError 空态 -->
                <section class="conflict-list__section">
                    <nue-text size="xs" class="conflict-list__section-title">
                        {{ t('sync.conflict.compareTitle') }}
                    </nue-text>
                    <loading-error
                        v-if="!hasFieldDiff"
                        class="conflict-list__loading-error"
                        :loading="false"
                        :error="false"
                        :empty="true"
                        :empty-message="t('sync.conflict.noFieldDiff')"
                        :empty-image-src="assetUrl('/images/todo.webp')"
                    />
                    <ul v-else class="conflict-list__diffs">
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
                    <nue-button theme="pure,small" @click="emit('close')">
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

.conflict-list__loading-error {
    flex: 1;
    min-height: 0;
    height: auto;
}

.conflict-list__groups {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin: var(--nue-padding-2xs) 0;
    padding: 0;
    list-style: none;
}

/* 差异详情：横向排版（卡片流式并行，非 flex column） */
.conflict-list__diffs {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--nue-gap-xs);
    margin: var(--nue-padding-2xs) 0;
    padding: 0;
    list-style: none;
}

.conflict-list__entry {
    display: flex;
    align-items: center;
    width: 100%;
    height: var(--nue-box-size-md);
    padding: var(--nue-padding-sm);
    gap: var(--nue-gap-xs);
    font-size: var(--nue-text-xs);
    border: none;
    border-radius: var(--nue-primary-radius);
    background: none;
    color: var(--nue-primary-text-color);
    transition: background ease-in var(--nue-animation-duration-xshort);
}

.conflict-list__entry:hover {
    background-color: var(--nue-primary-color-100);
}

.conflict-list__entry.is-active {
    background-color: var(--nue-primary-color-900);
    color: var(--nue-primary-color-0);
}

/* 详情：分区留白（非表头/网格） */
.conflict-list__detail-title {
    margin: 0;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-md);
    font-weight: 600;
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

/* 逐字段卡片：圆角 + 留白 + 状态色条（无表头/网格；横向流式） */
.conflict-list__diff {
    display: flex;
    flex-direction: column;
    flex: 1 1 240px;
    min-width: 0;
    gap: var(--nue-gap-2xs);
    padding: var(--nue-gap-xs) var(--nue-gap-sm);
    border-radius: var(--nue-primary-radius);
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
    color: var(--nue-success-color-100);
}

.conflict-list__symbol.is-removed {
    color: var(--nue-error-color-80);
}

.conflict-list__symbol.is-changed {
    color: var(--nue-warning-color-90);
}

/* 文字标签：小文本须 ≥4.5:1。底色为卡片 `-100`（非白底）⇒ 绿色须用 `-100`（实测 5.29），
   红/橙用 `-90`（7.19 / 5.34） */
.conflict-list__state-label {
    font-size: var(--nue-text-2xs);
    font-weight: 500;
}

.conflict-list__state-label.is-added {
    color: var(--nue-success-color-100);
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
    flex-basis: 100%;
    padding-top: var(--nue-gap-xs);
    border-top: 1px solid var(--nue-border-color);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

.conflict-list__diff.is-technical {
    background-color: var(--nue-primary-color-100);
    padding: var(--nue-gap-xs) var(--nue-gap-sm);
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