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
import ConflictList from './conflict-list.vue'
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

// @state 冲突列表展开（T165/W3：入口可交互；数据面经 ConflictList → useConflictUx）
const conflictOpen = ref(false)

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
            <!-- 首行：上次同步时间 / 从未同步 / 同步中… -->
            <li class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ lastSyncText }}
                </nue-text>
            </li>
            <!-- ② 回退本地镜像：显示「数据截至 X」+「可能不是最新」（AC8） -->
            <li v-if="freshness === 'mirror'" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-warning-color-60)">
                    {{ t('offline.freshness.mirror', { time: timeText ?? '' }) }}
                </nue-text>
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('offline.freshness.mirrorHint') }}
                </nue-text>
            </li>
            <!-- ③ 尚未同步完成（含空镜像/截断）：引导联网，不呈现为「数据丢失」（AC9） -->
            <li v-else-if="freshness === 'incomplete'" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-warning-color-60)">
                    {{ t('offline.freshness.incomplete') }}
                </nue-text>
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('offline.freshness.incompleteHint') }}
                </nue-text>
            </li>
            <!-- SHELL-06 C-41：暂停（离线/超限）显式可见，仅提示不阻断 -->
            <li v-if="status.paused" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-warning-color-60)">
                    {{ t('sync.pendingOffline', { count: status.pendingCount }) }}
                </nue-text>
            </li>
            <li v-else-if="status.pendingCount > 0" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('sync.pending', { count: status.pendingCount }) }}
                </nue-text>
            </li>
            <li v-if="status.failedCount > 0" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-error-color-60)">
                    {{ t('sync.failed', { count: status.failedCount }) }}
                </nue-text>
            </li>
            <!-- TASK-26 / T136 GAP-2：偏好队列推送失败（独立于业务失败计数，AC3-04） -->
            <li v-if="status.preferenceFailedCount > 0" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-error-color-60)">
                    {{ t('sync.preferenceFailed', { count: status.preferenceFailedCount }) }}
                </nue-text>
            </li>
            <!-- PS-14 / DP-1 + T165/W3：冲突记账条数入口（可交互 ⇒ 展开冲突列表：
                 只读对比 + 两种恢复动作）；warning 色：冲突为 LWW **已收敛**的结果事件
                 （非同步失败；败方快照已入 journal），与 `paused` 同属「状态性、需知情但非失败」 -->
            <li v-if="status.conflictCount > 0" class="sync-panel__row">
                <nue-button
                    class="sync-conflict-entry"
                    theme="pure,small"
                    :aria-expanded="conflictOpen"
                    @click="conflictOpen = !conflictOpen"
                >
                    {{ t('sync.conflict', { count: status.conflictCount }) }}
                </nue-button>
            </li>
            <!-- T165/W3：冲突列表/只读对比/恢复动作（弹层内展开；数据面经 useConflictUx） -->
            <li v-if="conflictOpen" class="sync-panel__row">
                <ConflictList />
            </li>
            <!-- DP-2B-5 / R-15：达上限 ⇒ 面板级折叠提示（未展开列表亦可见） -->
            <li v-if="status.conflictCount >= CONFLICT_JOURNAL_LIMIT" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-warning-color-60)">
                    {{ t('sync.conflict.foldLimit') }}
                </nue-text>
            </li>
            <!-- 全文仅经 title 与文本插值输出（禁 v-html）；2 行截断由 CSS 完成；
                         live region 只播摘要（见下方常驻活动区域），此处不带 aria-live -->
            <li v-if="status.lastError" class="sync-panel__row">
                <nue-text
                    size="xs"
                    color="var(--nue-error-color-60)"
                    :clamped="2"
                    :title="status.lastError"
                >
                    {{ status.lastError }}
                </nue-text>
            </li>
            <!-- ④ 覆盖度：未扫完（瞬态，自动消失） -->
            <li v-if="coverage.loadingMore" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-secondary-text-color)">
                    {{ t('offline.coverage.loadingMore') }}
                </nue-text>
            </li>
            <!-- ⑤ 覆盖度：触顶（常驻，独立于上一条；N 取实际行数，取不到退通用文案，不编造数字） -->
            <li v-if="coverage.truncated" class="sync-panel__row">
                <nue-text size="xs" color="var(--nue-warning-color-60)">
                    {{
                        loadedCount > 0
                            ? t('offline.coverage.truncated', { count: loadedCount })
                            : t('offline.coverage.truncatedGeneric')
                    }}
                </nue-text>
            </li>
            <!--
              【skill 偏离留痕｜ADR §5】本面板信息行与 footer 用原生 <li> 而非 <nue-dropdown-item>：
              nue-ui 1.10.58 与 1.11.0 的 NueDropdownItem 渲染均为 <li data-executeid onClick>，
              无 tabindex / role / keydown（两版逐文件核对，见 ADR §2 D-4 源码级等价表）→ 键盘不可达，
              无法承载 AC-03「Tab 进 footer 按钮 → Enter 触发」。skill 条目语境是菜单选项
              （execute-id + closeWhenExecuted）；本轮 footer 是动作按钮且按 C15 不挂 execute-id。
              行为等价子集内合法：不给控件补 role="menu"/"menuitem"，不给只读行套 item。
            -->
            <li class="sync-panel__footer">
                <nue-button theme="pure,small" :loading="manualSyncing" @click="runManualSync">
                    {{ status.paused ? t('sync.retryNow') : t('sync.syncNow') }}
                </nue-button>
            </li>
        </nue-dropdown>
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

/* 信息行（<li> 由本组件渲染，scoped 生效；面板根 <ul> 由库渲染，另见下方非 scoped 块） */
.sync-panel__row {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    color: var(--nue-secondary-text-color);
}

.sync-panel__row.is-failed {
    color: var(--nue-error-color-60);
}

.sync-panel__row.is-pending {
    color: var(--nue-warning-color-60);
}

/* footer 动作按钮行 */
.sync-panel__footer {
    display: flex;
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
    max-width: 18rem;
    padding: var(--nue-padding-xs);
}
</style>