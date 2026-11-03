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
 *              - DEF-134：右栏差异区改为 **Git diff 式左右对照**（固定表头 + 行对齐 + 三态三重冗余；
 *                ≤720px 上下堆叠）；技术字段默认**折叠**进「显示技术信息」；左栏标题优先**当前行**
 *                可读名（评论 / 检查项带父任务名），⛔ 不再回退败方快照（那是「只显示记录 ID」的根因）。
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
    groupConflictItems,
    isLongValue,
    splitTechnicalDiffs,
    type ConflictGroup,
    type FieldDiffKind
} from './conflict-diff'
import { conflictObjectTitle, recordTitleName } from './conflict-title'
import {
    formatConflictValue,
    isUnsetValue,
    type ConflictValueResolvers
} from './conflict-value-format'

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
    titles,
    retryFailed,
    keepServerPending,
    keepServerFailed,
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

/** 技术字段展开态（DEF-134：默认折叠 —— DESIGN §4.7） */
const technicalOpen = ref(false)

/** 复制状态（按钮文案反馈；A3 手动处理） */
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')

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
    skipped: 'sync.conflict.kind.skipped',
    'pull-local-wins': 'sync.conflict.kind.pull-local-wins'
}

const tableLabel = (table: string): string => (TABLE_KEYS[table] ? t(TABLE_KEYS[table]!) : table)

const kindLabel = (kind: string): string => (KIND_KEYS[kind] ? t(KIND_KEYS[kind]!) : kind)

const timeOf = (iso: string | undefined): string => {
    if (!iso) return '—'
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const groups = computed<ConflictGroup[]>(() => groupConflictItems(items.value))

/** 组头 = 对象名称（当前行可读名 ⇒ 「父任务名 · 摘要」⇒ 表名 + 短 ID；⛔ 不用败方快照回退） */
const titleOf = (group: ConflictGroup): string => {
    const base = titles.value[group.key]
    const current = comparison.value
    // 选中对象优先用**这次对比取到的当前行**（与右栏同源，避免标题与详情不同步）
    const source =
        current &&
        current.table === group.table &&
        current.entityId === group.entityId &&
        current.current
            ? {
                  name: recordTitleName(group.table, current.current),
                  parentTaskName: base?.parentTaskName ?? null
              }
            : base
    return conflictObjectTitle(group, source, tableLabel)
}

/** 选中对象（按实体判定 ⇒ 同一对象仅一行高亮，避免「全 active」） */
const isGroupActive = (group: ConflictGroup): boolean =>
    comparison.value?.table === group.table && comparison.value?.entityId === group.entityId

/** 点击对象行 ⇒ 直接展示该对象的最新冲突详情（`compareConflict` 亦取最新条目） */
const selectGroup = (group: ConflictGroup): void => {
    const item = group.items[group.items.length - 1]
    if (item) {
        copyState.value = 'idle'
        technicalOpen.value = false
        void compare(item)
    }
}

interface DiffRow {
    field: string
    kind: FieldDiffKind
    symbol: string
    label: string
    humanLabel: string
    loserText: string
    currentText: string
    /** DEF-133：空值 ⇒「未设置」弱化展示（不空白） */
    loserUnset: boolean
    currentUnset: boolean
    /** DEF-134：技术字段（默认折叠，展开后次要样式） */
    technical: boolean
}

/** 值格式化所需的解析器（store 查询经 `useConflictUx` 注入；缺省 ⇒ 安全回退） */
const valueResolvers = computed<ConflictValueResolvers>(() => ({
    tagName: props.ux.resolveTagName,
    projectName: props.ux.resolveProjectName
}))

const toRow = (diff: ConflictFieldDiff, technical: boolean): DiffRow => {
    const kind = classifyFieldDiff(diff)
    return {
        field: diff.field,
        kind,
        symbol: DIFF_SYMBOL[kind],
        label: t(DIFF_LABEL_KEY[kind]),
        humanLabel: fieldLabel(diff.field),
        loserText: formatConflictValue(diff.field, diff.loser, valueResolvers.value),
        currentText: formatConflictValue(diff.field, diff.current, valueResolvers.value),
        loserUnset: isUnsetValue(diff.loser),
        currentUnset: isUnsetValue(diff.current),
        technical
    }
}

/** 技术字段默认折叠（DESIGN §4.7）；拆到普通字段之后（次要段落） */
const diffGroups = computed(() => {
    const { normal, technical } = splitTechnicalDiffs(comparison.value?.diffs ?? [])
    return {
        normal: normal.map((diff) => toRow(diff, false)),
        technical: technical.map((diff) => toRow(diff, true))
    }
})

/** 实际渲染的行：普通字段 + （展开时）技术字段 */
const visibleRows = computed<DiffRow[]>(() =>
    technicalOpen.value
        ? [...diffGroups.value.normal, ...diffGroups.value.technical]
        : diffGroups.value.normal
)

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

/**
 * 手动处理提示（T643 / A3）：`conflict` / `skipped` 本批**不可自动恢复**（「重新生成 ID」属 `A3b`）
 * @description 面板给可见说明 + 可复制内容，不承诺一键重建
 */
const needsManualRecovery = computed(() => {
    const kind = activeItem.value?.kind
    return kind === 'conflict' || kind === 'skipped'
})

/** 复制状态（按钮文案反馈） */
const copyLoserLabel = computed(() => {
    if (copyState.value === 'copied') return t('sync.conflict.copySuccess')
    if (copyState.value === 'failed') return t('sync.conflict.copyFailed')
    return t('sync.conflict.copyLoser')
})

/** 复制败方（我的修改）内容 —— 本机剪贴板，不发网络（R-H） */
const copyLoser = async (): Promise<void> => {
    copyState.value = 'idle'
    const text = JSON.stringify(comparison.value?.loser ?? {}, null, 2)
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard?.writeText) {
        copyState.value = 'failed'
        return
    }
    try {
        await clipboard.writeText(text)
        copyState.value = 'copied'
    } catch {
        copyState.value = 'failed'
    }
}

/** A1 `pull-local-wins`：败方是**云端**版本、当前行是**我的**版本 ⇒ 两侧标签不能沿用默认语义 */
const isPullLocalWins = computed(() => activeItem.value?.kind === 'pull-local-wins')
const loserSideLabel = computed(() =>
    isPullLocalWins.value
        ? t('sync.conflict.pullLocalWinsLoserLabel')
        : t('sync.conflict.loserLabel')
)
const currentSideLabel = computed(() =>
    isPullLocalWins.value
        ? t('sync.conflict.pullLocalWinsCurrentLabel')
        : t('sync.conflict.currentLabel')
)
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
                            :title="titleOf(group)"
                            @click="selectGroup(group)"
                        >
                            <span class="conflict-list__entry-text">{{ titleOf(group) }}</span>
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

                <!-- 差异详情：Git diff 式左右对照（DEF-134 / DESIGN §4.7）；无字段差异 ⇒ LoadingError 空态 -->
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
                    <template v-else>
                        <div class="conflict-list__compare">
                            <!-- 固定表头（sticky）：左「我的修改」/ 右「云端最新」 -->
                            <div class="conflict-list__compare-head">
                                <span data-side="label" aria-hidden="true"></span>
                                <span class="conflict-list__compare-side" data-side="loser">
                                    {{ loserSideLabel }}
                                </span>
                                <span class="conflict-list__compare-side" data-side="current">
                                    {{ currentSideLabel }}
                                </span>
                            </div>
                            <ul class="conflict-list__diff-list">
                                <li
                                    v-for="row in visibleRows"
                                    :key="row.field"
                                    class="conflict-list__diff-row"
                                    :class="[`is-${row.kind}`, { 'is-technical': row.technical }]"
                                >
                                    <!-- 行首：字段标签 + 三态（符号 + 文字，不单靠颜色） -->
                                    <div class="conflict-list__diff-label" data-side="label">
                                        <span
                                            class="conflict-list__symbol"
                                            :class="`is-${row.kind}`"
                                            aria-hidden="true"
                                        >
                                            {{ row.symbol }}
                                        </span>
                                        <span class="conflict-list__field-name">
                                            {{ row.humanLabel }}
                                        </span>
                                        <span
                                            class="conflict-list__state-label"
                                            :class="`is-${row.kind}`"
                                        >
                                            {{ row.label }}
                                        </span>
                                    </div>
                                    <!-- 左格：我的修改（败方快照） -->
                                    <div
                                        class="conflict-list__diff-cell is-loser"
                                        data-side="loser"
                                    >
                                        <span class="conflict-list__cell-side">
                                            {{ loserSideLabel }}
                                        </span>
                                        <span
                                            class="conflict-list__text"
                                            :class="{
                                                'is-expanded': valueExpanded(row.field, 'loser'),
                                                'is-unset': row.loserUnset
                                            }"
                                            :title="
                                                valueExpanded(row.field, 'loser')
                                                    ? undefined
                                                    : row.loserText
                                            "
                                            >{{ row.loserText }}</span
                                        >
                                        <button
                                            v-if="isLongValue(row.loserText)"
                                            class="conflict-list__value-toggle"
                                            :aria-expanded="valueExpanded(row.field, 'loser')"
                                            @click="toggleValue(row.field, 'loser')"
                                        >
                                            {{
                                                valueExpanded(row.field, 'loser')
                                                    ? t('sync.conflict.collapse')
                                                    : t('sync.conflict.expand')
                                            }}
                                        </button>
                                    </div>
                                    <!-- 窄屏堆叠时的两侧分隔符号（宽屏隐藏） -->
                                    <span class="conflict-list__stack-sep" aria-hidden="true"
                                        >↓</span
                                    >
                                    <!-- 右格：云端最新（本地当前行） -->
                                    <div
                                        class="conflict-list__diff-cell is-current"
                                        data-side="current"
                                    >
                                        <span class="conflict-list__cell-side">
                                            {{ currentSideLabel }}
                                        </span>
                                        <span
                                            class="conflict-list__text"
                                            :class="{
                                                'is-expanded': valueExpanded(row.field, 'current'),
                                                'is-unset': row.currentUnset
                                            }"
                                            :title="
                                                valueExpanded(row.field, 'current')
                                                    ? undefined
                                                    : row.currentText
                                            "
                                            >{{ row.currentText }}</span
                                        >
                                        <button
                                            v-if="isLongValue(row.currentText)"
                                            class="conflict-list__value-toggle"
                                            :aria-expanded="valueExpanded(row.field, 'current')"
                                            @click="toggleValue(row.field, 'current')"
                                        >
                                            {{
                                                valueExpanded(row.field, 'current')
                                                    ? t('sync.conflict.collapse')
                                                    : t('sync.conflict.expand')
                                            }}
                                        </button>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <!-- 技术字段（时间戳 / 版本 / ID 等）：默认折叠，不参与主对比区 -->
                        <button
                            v-if="diffGroups.technical.length > 0"
                            type="button"
                            class="conflict-list__tech-toggle"
                            :aria-expanded="technicalOpen"
                            @click="technicalOpen = !technicalOpen"
                        >
                            {{
                                technicalOpen
                                    ? t('sync.conflict.hideTechnical')
                                    : t('sync.conflict.showTechnical')
                            }}
                            <span aria-hidden="true">{{ technicalOpen ? '▾' : '▸' }}</span>
                        </button>
                    </template>
                </section>

                <!-- T643 / A3：本批不可自动恢复的条目 ⇒ 可见说明 + 内容可复制（不承诺一键重建） -->
                <div v-if="needsManualRecovery" class="conflict-list__manual">
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ t('sync.conflict.manualRecoveryHint') }}
                    </nue-text>
                    <nue-button theme="pure,small" @click="copyLoser">
                        {{ copyLoserLabel }}
                    </nue-button>
                </div>

                <!-- T643 / A2：「保留服务端」两态（失败 / 待下次同步）⇒ 不静默、不假装成功 -->
                <nue-text v-if="keepServerPending" size="xs" color="var(--nue-warning-color-90)">
                    {{ t('sync.conflict.keepServerPending') }}
                </nue-text>
                <nue-text v-if="keepServerFailed" size="xs" color="var(--nue-error-color-90)">
                    {{ t('sync.conflict.keepServerFailed') }}
                </nue-text>

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

/* 左栏对象行：显式左对齐（`<button>` 默认居中 —— DEF-134 走查原话②）；条目高 ≥40px */
.conflict-list__entry {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: var(--nue-box-size-md);
    padding: var(--nue-padding-2xs) var(--nue-padding-sm);
    gap: var(--nue-gap-xs);
    font-size: var(--nue-text-xs);
    text-align: left;
    border: none;
    border-radius: var(--nue-primary-radius);
    background: none;
    color: var(--nue-primary-text-color);
    transition: background ease-in var(--nue-animation-duration-xshort);
}

/* 长文本单行省略（完整标题在 `title` 提示） */
.conflict-list__entry-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
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

/* 差异对照（DEF-134 / DESIGN §4.7）：Git diff 式左右两列；表头 sticky、行高 ≥40px */
.conflict-list__compare {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: var(--nue-padding-2xs) 0;
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    /* ⛔ 不可用 `overflow: hidden`：会把手头变成滚动容器 ⇒ sticky 表头失效（拖回不再吸顶） */
}

/* 表头与数据行共用同一列轨道 ⇒ 逐字段对齐（字段标签 min(8rem, 28%) + 两侧等宽） */
.conflict-list__compare-head,
.conflict-list__diff-row {
    display: grid;
    grid-template-columns: min(8rem, 28%) minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--nue-gap-xs);
    align-items: start;
}

.conflict-list__compare-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--nue-padding-2xs) var(--nue-padding-sm);
    border-bottom: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius) var(--nue-primary-radius) 0 0;
    background-color: var(--nue-primary-color-100);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
    font-weight: var(--nue-font-weight-medium, 500);
}

.conflict-list__diff-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
}

.conflict-list__diff-row {
    min-height: var(--nue-box-size-md);
    padding: var(--nue-padding-2xs) var(--nue-padding-sm);
    border-bottom: 1px solid var(--nue-border-color);
}

.conflict-list__diff-row:last-child {
    border-bottom: none;
}

.conflict-list__diff-label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--nue-gap-2xs);
    min-width: 0;
    padding-block: var(--nue-padding-2xs);
}

/* 值格：宽屏只靠表头指明两侧 ⇒ 格内来源标签隐藏（堆叠时再显） */
.conflict-list__diff-cell {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    min-width: 0;
    min-height: var(--nue-box-size-sm);
    padding: var(--nue-padding-2xs) var(--nue-gap-xs);
    border: 1px solid transparent;
    border-radius: var(--nue-radius-sm);
}

.conflict-list__cell-side {
    display: none;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

/* 窄屏堆叠符：宽屏不占列 */
.conflict-list__stack-sep {
    display: none;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

/* 三态：颜色只作**强化**（行首列同时有符号 + 文字标签） */
.conflict-list__diff-row.is-removed .conflict-list__diff-cell.is-loser {
    border-color: var(--nue-error-color-80);
    background-color: var(--nue-error-color-10);
}

.conflict-list__diff-row.is-added .conflict-list__diff-cell.is-current {
    border-color: var(--nue-success-color-80);
    background-color: var(--nue-success-color-10);
}

.conflict-list__diff-row.is-changed .conflict-list__diff-cell {
    border-color: var(--nue-warning-color-80);
    background-color: var(--nue-primary-color-100);
}

/* 窄屏（≤720px）：同字段上下堆叠（先我的修改、后云端最新，不隐藏任一侧） */
@media (max-width: 720px) {
    .conflict-list__compare-head {
        display: none;
    }

    .conflict-list__diff-row {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--nue-gap-2xs);
    }

    .conflict-list__cell-side {
        display: block;
    }

    .conflict-list__stack-sep {
        display: flex;
        align-items: center;
        justify-content: center;
    }
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

/* 值行：来源标签 + 值（宽屏由表头承载来源，堆叠时由格内标签承载） */

.conflict-list__text {
    min-width: 0;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.6;
    /* 默认 1 行省略（长值 + 「展开」；完整值在 title 提示里） */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 展开后：保留滚动上限，不撑爆对话框 */
.conflict-list__text.is-expanded {
    max-height: 7.5rem;
    overflow-y: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

/* 来源层级：我的修改 = secondary，云端最新 = primary + medium */
.conflict-list__diff-cell.is-loser .conflict-list__text {
    color: var(--nue-secondary-text-color);
}

.conflict-list__diff-cell.is-current .conflict-list__text {
    color: var(--nue-primary-text-color);
    font-weight: var(--nue-font-weight-medium, 500);
}

/* DEF-133：空值（「未设置」）弱化，不空白 */
.conflict-list__diff-cell .conflict-list__text.is-unset {
    color: var(--nue-secondary-text-color);
    font-style: italic;
}

.conflict-list__value-toggle {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--nue-primary-color-600);
    font-size: var(--nue-text-2xs);
}

/* 技术字段：默认折叠；展开后次要样式（更小字号 + 次要色），不抢主对比区 */
.conflict-list__tech-toggle {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: var(--nue-gap-2xs);
    min-height: var(--nue-box-size-md);
    padding: 0 var(--nue-gap-sm);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background: none;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
    cursor: pointer;
}

.conflict-list__tech-toggle:hover {
    background-color: var(--nue-primary-color-100);
}

.conflict-list__tech-toggle:focus-visible {
    outline: 2px solid var(--nue-primary-color-600);
    outline-offset: 2px;
}

.conflict-list__diff-row.is-technical .conflict-list__field-name,
.conflict-list__diff-row.is-technical .conflict-list__text,
.conflict-list__diff-row.is-technical .conflict-list__diff-cell.is-current .conflict-list__text {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
    font-weight: 400;
}

.conflict-list__safety {
    color: var(--nue-secondary-text-color);
}

.conflict-list__manual {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-sm);
    padding: var(--nue-gap-xs) var(--nue-gap-sm);
    border-radius: var(--nue-border-radius-sm);
    background-color: var(--nue-primary-color-100);
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