<script setup lang="ts">
/**
 * 同步状态（SHELL-02：并入主侧栏 70px 轨道底部、齿轮上方）
 * @description 轨道按钮 = tooltip「同步」+ refresh 图标（管线着色）+ 数据可信度角标（伪元素圆点），
 *              点击展开 NueDropdown 面板：首行时间、②离线·有镜像 / ③尚未同步完成、
 *              待推送 N、失败 N、错误摘要（2 行截断 + title 全文）、④正在加载更多 / ⑤触顶、
 *              footer「立即同步」。宿主为 webapp 侧栏 rail-host 注册表元素，宿主缺失
 *              （抽屉分支/非 index 路由/profile 未就绪）即整体不渲染，无悬浮层回落。
 *
 *              T115b/r7：②③④⑤ 全部由内容区顶部条迁入本面板（顶部零挂载）；面板根为库渲染的 `<ul>`
 *              ⇒ 每行一律 `<li>`（P8 / C12）。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md（C1–C16 约束与实测证据）
 * @see docs/adr/2026-09-23-two-end-sync-status-unification.md（D-2 数据映射 / D-3 顶部零挂载 / D-4 指示通道）
 */
import { computed, nextTick, ref, watch } from 'vue'
import { NueMessage, type NueDropdown } from 'nue-ui'
import { locale, t } from '@nao-todo/shared/locales'
import {
    formatMirrorPulledAt,
    resolveCoverageHints,
    resolveFreshness,
    useReadOnlyState
} from '@nao-todo/presentation/offline'
import { railBottomHost } from '@/components/app/aside-v2/rail-host'
import { open as settingsDialogOpen } from '@/components/settings/dialog/state'
import { useManualSync, useMirrorLoadedCount, useSyncStatus } from '@/hooks'
import ConflictDialog from './conflict-dialog.vue'
import { CONFLICT_JOURNAL_LIMIT } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'

defineOptions({ name: 'SyncStatusBar' })

const props = withDefaults(
    defineProps<{
        /**
         * 首行时间来源（T115b 单一来源开关；端差异只出现在端自己的挂载点）
         * @description `'lastSync'`（desktop 默认，逐字不变）= 上次**完全成功**运行（内存态）；
         *              `'mirrorPulledAt'`（web）= 上次**完整拉取**镜像时间（仅完整拉取推进 + 落盘）。
         *              不用「传值」而用「来源开关」，避免 `null` 的哨兵歧义（web「从未拉取」仍落 `sync.neverSynced`）。
         */
        syncTimeSource?: 'lastSync' | 'mirrorPulledAt'
    }>(),
    { syncTimeSource: 'lastSync' }
)

const { status } = useSyncStatus()
const { syncing: manualSyncing, run: runManualSync } = useManualSync()
// `read-only-state.ts` 为 ADR 保留项（兼服务身份域离线闸门 / 离线 UI 角标）；本面板消费的是
// C-60 的「离线」判定（`resolveFreshness({ isOffline })`），非「业务只读」语义（业务 7 域 2A 已撤闸门）⇒ 别名
const { isReadOnly: isOffline } = useReadOnlyState()

/** 触顶文案 N：镜像中实际已加载行数（0 ⇒ 用通用文案，不编造数字） */
const loadedCount = useMirrorLoadedCount()

// @state 面板内容门控（C9：@open 渲染 / @close 移除；不依赖关闭动画 afterClose —— jsdom 无动画不触发）
const panelOpen = ref(false)

// @state 下拉实例（C11 设置对话框开启时收起；C16 焦点归还时定位轨道按钮）
const dropdownRef = ref<InstanceType<typeof NueDropdown> | null>(null)

// @state 冲突对话框开（T338：入口「冲突 N」⇒ 打开对话框：左栏记录 / 右栏 diff）
const conflictDialogOpen = ref(false)
const conflictEntryRowRef = ref<HTMLLIElement | null>(null)

// T338：关闭对话框后把焦点归还触发按钮（a11y；ref 置于行上，取内部 button 聚焦）
watch(conflictDialogOpen, (isOpen) => {
    if (!isOpen) void nextTick(() => conflictEntryRowRef.value?.querySelector('button')?.focus())
})

// @computed 同步中（含手动触发）
const syncing = computed(() => status.value.syncing || manualSyncing.value)

/**
 * @computed 状态着色修饰（C14/D2，**通道②**：管线健康）
 * @description 三态优先级（**逐字不变，新增数据状态不得插入**）：同步中（loading 图标，不额外着色）>
 *              失败 > 待推送 > 常态。颜色走按钮主题令牌（--nue-button-color），随双主题/暗色自动适配。
 */
const statusTheme = computed(() => {
    if (syncing.value) return ''
    if (status.value.failedCount > 0) return 'is-failed'
    if (status.value.paused || status.value.pendingCount > 0) return 'is-pending'
    return ''
})

// @computed 镜像新鲜度（C-60 判定函数零改动）：'updated' | 'mirror' | 'incomplete'
const freshness = computed(() =>
    resolveFreshness({
        isOffline: isOffline.value,
        mirrorPulledAt: status.value.mirrorPulledAt,
        mirrorTruncated: status.value.mirrorTruncated
    })
)

// @computed 覆盖度提示（④ 未扫完瞬态 / ⑤ 触顶常驻；两条独立，不合并）
const coverage = computed(() =>
    resolveCoverageHints({
        syncing: status.value.syncing,
        mirrorTruncated: status.value.mirrorTruncated
    })
)

// @computed 「数据截至」时间（非法值 ⇒ null ⇒ 面板不渲染时间，落 ③）
const timeText = computed(() => formatMirrorPulledAt(status.value.mirrorPulledAt, locale.value))

// @computed 面板分区可见性（按类别聚合，避免空分区）
// 数据区：新鲜度非 updated（②③）或覆盖度提示（④⑤）任一生效
const hasDataSection = computed(
    () => freshness.value !== 'updated' || coverage.value.loadingMore || coverage.value.truncated
)
// 待处理区：暂停/待推送/失败/偏好失败任一 > 0
const hasQueueSection = computed(
    () =>
        status.value.paused ||
        status.value.pendingCount > 0 ||
        status.value.failedCount > 0 ||
        status.value.preferenceFailedCount > 0
)

/**
 * @computed 数据可信度角标（**通道③**，ADR D-4；与通道② 正交、同时呈现）
 * @description 优先级：alert（不完整 或 触顶）> warn（离线·有镜像）> 无。
 *              「同步中」不吞角标（R2）；触顶在**在线**时亦独立成立（freshness 恒 updated）。
 */
const dataBadgeClass = computed(() => {
    if (freshness.value === 'incomplete' || status.value.mirrorTruncated) return 'is-data-alert'
    if (freshness.value === 'mirror') return 'is-data-warn'
    return ''
})

/** @computed 数据可信度状态短语（**通道④**，由既有 i18n 键拼接，不新增键） */
const dataStatusText = computed(() => {
    if (freshness.value === 'incomplete' || status.value.mirrorTruncated) {
        return status.value.mirrorTruncated
            ? t('offline.coverage.truncatedGeneric')
            : t('offline.freshness.incomplete')
    }
    if (freshness.value === 'mirror') return t('offline.freshness.mirrorHint')
    return ''
})

/** @computed 轨道按钮可访问名 / tooltip：常态逐字不变（`sync.title`），异常态追加状态短语 */
const statusText = computed(() =>
    dataStatusText.value ? `${t('sync.title')} · ${dataStatusText.value}` : t('sync.title')
)

// @computed 首行文案：从未同步 / 同步中… / 上次同步 HH:mm（时间与计数均为 i18n 命名插值）
const lastSyncText = computed(() => {
    if (syncing.value) return t('sync.syncing')
    const iso =
        props.syncTimeSource === 'mirrorPulledAt'
            ? status.value.mirrorPulledAt
            : status.value.lastSyncAt
    if (!iso) return t('sync.neverSynced')
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return t('sync.neverSynced')
    return t('sync.lastSyncAt', {
        time: date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    })
})

// @computed 读屏摘要（NFR：只播同步中/失败计数/数据不完整摘要，不播 lastError 全文与时间/N）
const liveSummary = computed(() => {
    if (syncing.value) return t('sync.syncing')
    if (status.value.failedCount > 0) return t('sync.failed', { count: status.value.failedCount })
    if (freshness.value === 'incomplete' || status.value.mirrorTruncated)
        return t('offline.freshness.incomplete')
    return ''
})

// @helpers 轨道按钮 DOM（下拉根内的触发器；NueButton 根即 <button>）
const getRailButton = (): HTMLButtonElement | null => {
    const root = dropdownRef.value?.$el as HTMLElement | null | undefined
    return root?.querySelector<HTMLButtonElement>('.sync-rail-btn') ?? null
}

// @handlers 面板开启：渲染内容（C9）
const handleOpen = (): void => {
    panelOpen.value = true
}

// @handlers 面板关闭：移除内容 + 归还焦点给轨道按钮（C16：nextTick 同步可测；disabled 时跳过、事后不补）
const handleClose = (): void => {
    panelOpen.value = false
    void nextTick(() => {
        const button = getRailButton()
        if (!button || button.disabled) return
        button.focus()
    })
}

// @watch 设置对话框开启时收起面板（C11）：池内同级按 DOM 序叠放，面板 overlay 会压住后开的
//        对话框并吞点击；用响应式 open ref 而非非响应式 DOM 查询（快捷键抑制沿用它，两者不冲突）
watch(settingsDialogOpen, (visible) => {
    if (visible) dropdownRef.value?.close()
})

// @watch 偏好同步失败 ⇒ 可见提示（T136 GAP-2 / AC4-04：不静默吞；同一失败数不重复弹）
watch(
    () => status.value.preferenceFailedCount,
    (count, previous) => {
        if (count > 0 && count !== previous) {
            NueMessage.warn(t('sync.preferenceFailed', { count }))
        }
    }
)
</script>

<template>
    <!-- 宿主缺失即整体不渲染（C5/AC-08/AC-10）：元素目标 + v-if，无字符串选择器、无 warn -->
    <Teleport v-if="railBottomHost" :to="railBottomHost">
        <!--
          transparent（D5 = B，用户拍板）：overlay 不占屏 ⇒ ① 面板开着时点齿轮/轨道其它元素一次即生效；
          ② 库在 transparent 分支挂 ResizeObserver，消除 R13 面板纵向漂移；③ C11 的 ≤240ms 残留吞点击窗口消失。
        -->
        <nue-dropdown
            ref="dropdownRef"
            theme="sync-panel"
            trigger-type="click"
            placement="top-start"
            :transparent="true"
            @open="handleOpen"
            @close="handleClose"
        >
            <!-- 轨道按钮：可访问名走 aria-label（C13），异常态由既有键拼接（通道④）；展开态走 trigger slot 的 visible -->
            <template #trigger="{ trigger, visible }">
                <nue-tooltip :content="statusText" placement="right-center" size="small">
                    <nue-button
                        class="sync-rail-btn"
                        :class="[statusTheme, dataBadgeClass]"
                        theme="pure"
                        icon="ntd-sync2"
                        :loading="syncing"
                        :aria-label="statusText"
                        :aria-expanded="visible"
                        @click="trigger"
                    />
                </nue-tooltip>
            </template>
            <!--
              面板内容行：@open 渲染 / @close 移除（C9）；面板根是库内 <ul>，故每行均为 <li>（P8/C12）。
              以下 ②③④⑤ 由内容区顶部条迁入（T115b/r7：顶部零挂载，原文案逐字保留）。
            -->
            <!--
              面板分区行：@open 渲染 / @close 移除（C9）。面板根是库内 <ul> ⇒ **每个分区为一个 <li>**
              （P8/C12：直系子节点仍为 <li>），分区内部用 <div> 组织，按类别聚合：
              概览（时间）/ 数据（可信度与覆盖度）/ 待处理（计数 chips）/ 冲突 / 错误；footer 动作常驻。
            -->
            <!-- 概览：上次同步时间 / 从未同步 / 同步中… -->
            <li class="sync-panel__section">
                <span class="sync-panel__section-title">{{ t('sync.section.overview') }}</span>
                <nue-div class="sync-panel__section-body" justify="space-between">
                    <nue-text size="xs" color="var(--nue-secondary-text-color)">
                        {{ lastSyncText }}
                    </nue-text>
                    <nue-button theme="pure,small" :loading="manualSyncing" @click="runManualSync">
                        {{ status.paused ? t('sync.retryNow') : t('sync.syncNow') }}
                    </nue-button>
                </nue-div>
            </li>
            <!-- 数据：② 回退本地镜像 / ③ 尚未同步完成 / ④ 未扫完 / ⑤ 触顶（仅相关时渲染） -->
            <li v-if="hasDataSection" class="sync-panel__section">
                <span class="sync-panel__section-title">{{ t('sync.section.data') }}</span>
                <div class="sync-panel__section-body">
                    <template v-if="freshness === 'mirror'">
                        <nue-text size="xs" color="var(--nue-warning-color-90)">
                            {{ t('offline.freshness.mirror', { time: timeText ?? '' }) }}
                        </nue-text>
                        <nue-text size="xs" color="var(--nue-secondary-text-color)">
                            {{ t('offline.freshness.mirrorHint') }}
                        </nue-text>
                    </template>
                    <template v-else-if="freshness === 'incomplete'">
                        <nue-text size="xs" color="var(--nue-warning-color-90)">
                            {{ t('offline.freshness.incomplete') }}
                        </nue-text>
                        <nue-text size="xs" color="var(--nue-secondary-text-color)">
                            {{ t('offline.freshness.incompleteHint') }}
                        </nue-text>
                    </template>
                    <!-- ④ 覆盖度：未扫完（瞬态，自动消失） -->
                    <nue-text
                        v-if="coverage.loadingMore"
                        size="xs"
                        color="var(--nue-secondary-text-color)"
                    >
                        {{ t('offline.coverage.loadingMore') }}
                    </nue-text>
                    <!-- ⑤ 覆盖度：触顶（常驻；N 取实际行数，取不到退通用文案，不编造数字） -->
                    <nue-text
                        v-if="coverage.truncated"
                        size="xs"
                        color="var(--nue-warning-color-90)"
                    >
                        {{
                            loadedCount > 0
                                ? t('offline.coverage.truncated', { count: loadedCount })
                                : t('offline.coverage.truncatedGeneric')
                        }}
                    </nue-text>
                </div>
            </li>
            <!-- 待处理：暂停 / 待推送 / 失败 / 偏好失败（横向 chips；仅 >0 时渲染） -->
            <li v-if="hasQueueSection" class="sync-panel__section">
                <span class="sync-panel__section-title">{{ t('sync.section.queue') }}</span>
                <div class="sync-panel__section-body sync-panel__chips">
                    <span v-if="status.paused" class="sync-panel__chip is-warning">
                        {{ t('sync.pendingOffline', { count: status.pendingCount }) }}
                    </span>
                    <span v-else-if="status.pendingCount > 0" class="sync-panel__chip">
                        {{ t('sync.pending', { count: status.pendingCount }) }}
                    </span>
                    <span v-if="status.failedCount > 0" class="sync-panel__chip is-error">
                        {{ t('sync.failed', { count: status.failedCount }) }}
                    </span>
                    <span v-if="status.preferenceFailedCount > 0" class="sync-panel__chip is-error">
                        {{ t('sync.preferenceFailed', { count: status.preferenceFailedCount }) }}
                    </span>
                </div>
            </li>
            <!-- 冲突：记账条数入口（可交互 ⇒ 冲突对话框）+ 达上限折叠提示 -->
            <li
                v-if="status.conflictCount > 0"
                ref="conflictEntryRowRef"
                class="sync-panel__section"
            >
                <span class="sync-panel__section-title">{{ t('sync.section.conflict') }}</span>
                <div class="sync-panel__section-body">
                    <nue-button
                        class="sync-conflict-entry"
                        theme="pure,small"
                        aria-haspopup="dialog"
                        @click="conflictDialogOpen = true"
                    >
                        {{ t('sync.conflict', { count: status.conflictCount }) }}
                    </nue-button>
                    <nue-text
                        v-if="status.conflictCount >= CONFLICT_JOURNAL_LIMIT"
                        size="xs"
                        color="var(--nue-warning-color-90)"
                    >
                        {{ t('sync.conflict.foldLimit') }}
                    </nue-text>
                </div>
            </li>
            <!-- 错误：最近一次运行的首个错误（2 行截断 + title 全文；禁 v-html） -->
            <li v-if="status.lastError" class="sync-panel__section">
                <span class="sync-panel__section-title">{{ t('sync.section.error') }}</span>
                <div class="sync-panel__section-body">
                    <nue-text
                        size="xs"
                        color="var(--nue-error-color-90)"
                        :clamped="2"
                        :title="status.lastError"
                    >
                        {{ status.lastError }}
                    </nue-text>
                </div>
            </li>
        </nue-dropdown>
        <!-- T338：冲突对话框（入口 = 面板行「冲突 N」；NueDialog 传送至 body 弹层池） -->
        <ConflictDialog v-model="conflictDialogOpen" />
        <!--
          常驻读屏活动区域（NFR「只播摘要」）：只播同步中/失败计数/数据不完整摘要，**不含** lastError 全文。
          视觉隐藏用 WCAG 惯例（clip-path 而非 display:none/hidden，读屏仍可播报）；
          position:absolute 使其脱离 .aside__bottom 的 flex 流向，不产生 gap、不影响齿轮 rect。
        -->
        <div class="sync-live-region" aria-live="polite">{{ liveSummary }}</div>
    </Teleport>
</template>

<style scoped>
/* 轨道按钮：与齿轮同尺寸同色（C14/AC-11；常态 600 → hover 900），状态色另见 is-pending/is-failed */
.sync-rail-btn {
    --nue-button-color: var(--nue-primary-color-600);
    --nue-button-hover-color: var(--nue-primary-color-900);
    --nue-button-active-color: var(--nue-primary-color-900);
    --nue-button-border-color: transparent;
    /* 齿轮按钮无边框（border:none）——库按钮 1px 透明边框会多出 2px 外尺寸，
       故清零边框保证与齿轮 rect 同尺寸（库内无 border-width 令牌可用） */
    border: 0;
    font-size: var(--nue-text-2xl);
    /* 通道③ 角标定位锚点（position 变更不产生 layout shift） */
    position: relative;
}

/* D2：修正状态色令牌（原 --warning-color 是局部分组令牌、--nue-danger-hsl-color 全仓无定义） */
.sync-rail-btn.is-pending {
    --nue-button-color: var(--nue-warning-color-60);
}

.sync-rail-btn.is-failed {
    --nue-button-color: var(--nue-error-color-60);
}

/* 通道③ 数据可信度角标（ADR D-4）：伪元素 ⇒ 不新增节点、不破 24×24 盒；置于盒内规避侧栏裁切 */
.sync-rail-btn::after {
    content: '';
    position: absolute;
    top: 1px;
    right: 1px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: none;
}

.sync-rail-btn.is-data-alert::after {
    display: block;
    background-color: var(--nue-error-color-60);
}

.sync-rail-btn.is-data-warn::after {
    display: block;
    background-color: var(--nue-warning-color-60);
}

/* 面板分区（每分区一个 <li>，由本组件渲染 ⇒ scoped 生效）：分区标题 + 分区内容；分区之间 1px 分隔 */
.sync-panel__section {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    padding: var(--nue-gap-xs) 0;
    border-top: 1px solid var(--nue-border-color);
}

.sync-panel__section:first-child {
    padding-top: 0;
    border-top: none;
}

.sync-panel__section-title {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    font-weight: 500;
}

.sync-panel__section-body {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    font-size: var(--nue-text-xs);
}

/* 计数 chips：横向排列（不占整行、不竖堆） */
.sync-panel__chips {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--nue-gap-xs);
}

.sync-panel__chip {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--nue-gap-xs);
    border-radius: var(--nue-primary-radius);
    background-color: var(--nue-primary-color-100);
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-2xs);
}

.sync-panel__chip.is-warning {
    color: var(--nue-warning-color-90);
}

.sync-panel__chip.is-error {
    color: var(--nue-error-color-90);
}

/* footer 动作按钮行（与分区同宽，上分隔） */
.sync-panel__footer {
    display: flex;
    padding-top: var(--nue-gap-xs);
    border-top: 1px solid var(--nue-border-color);
}

/* 读屏活动区域：视觉隐藏（WCAG sr-only，非 display:none/hidden）；绝对定位脱离 flex 布局 */
.sync-live-region {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
</style>

<style>
/* 面板根 <ul> 由库渲染并经弹层池 Teleport（无本组件 scope id）→ 用 theme 类限定作用域。
   限宽避免超长 lastError 撑破面板（AC-05；行内文本为 2 行截断）。 */
.nue-dropdown--sync-panel {
    min-width: 12rem;
    max-width: 24rem;
    padding: var(--nue-padding-xs);
}
</style>