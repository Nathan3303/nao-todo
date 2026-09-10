<script setup lang="ts">
/**
 * 桌面端同步状态（SHELL-02：并入主侧栏 70px 轨道底部、齿轮上方）
 * @description 轨道按钮 = tooltip「同步」+ refresh 图标（状态着色），点击展开 NueDropdown 面板：
 *              上次同步时间/从未同步（同步中显示「同步中…」）、待推送 N、失败 N、错误摘要
 *              （2 行截断 + title 全文）→ footer「立即同步」。宿主为 webapp 侧栏 rail-host 注册表
 *              元素，宿主缺失（抽屉分支/非 index 路由/profile 未就绪）即整体不渲染，无悬浮层回落。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md（C1–C16 约束与实测证据）
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { NueDropdown } from 'nue-ui'
import { locale, t } from '@nao-todo/shared'
import { railBottomHost } from '@/components/app/aside-v2/rail-host'
import { open as settingsDialogOpen } from '@/components/settings/dialog/state'
import { useManualSync, useSyncStatus } from '@/hooks'

defineOptions({ name: 'SyncStatusBar' })

const { status } = useSyncStatus()
const { syncing: manualSyncing, run: runManualSync } = useManualSync()

// @state 面板内容门控（C9：@open 渲染 / @close 移除；不依赖关闭动画 afterClose —— jsdom 无动画不触发）
const panelOpen = ref(false)

// @state 下拉实例（C11 设置对话框开启时收起；C16 焦点归还时定位轨道按钮）
const dropdownRef = ref<InstanceType<typeof NueDropdown> | null>(null)

// @computed 同步中（含手动触发）
const syncing = computed(() => status.value.syncing || manualSyncing.value)

/**
 * @computed 状态着色修饰（C14/D2）
 * @description 三态优先级：同步中（loading 图标，不额外着色）> 失败 > 待推送 > 常态。
 *              颜色走按钮主题令牌（--nue-button-color），随双主题/暗色自动适配。
 */
const statusTheme = computed(() => {
    if (syncing.value) return ''
    if (status.value.failedCount > 0) return 'is-failed'
    if (status.value.pendingCount > 0) return 'is-pending'
    return ''
})

// @computed 首行文案：从未同步 / 同步中… / 上次同步 HH:mm（时间与计数均为 i18n 命名插值）
const lastSyncText = computed(() => {
    if (syncing.value) return t('sync.syncing')
    const iso = status.value.lastSyncAt
    if (!iso) return t('sync.neverSynced')
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return t('sync.neverSynced')
    return t('sync.lastSyncAt', {
        time: date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    })
})

// @computed 读屏摘要（NFR：只播同步中/失败计数摘要，不播 lastError 全文）
const liveSummary = computed(() => {
    if (syncing.value) return t('sync.syncing')
    if (status.value.failedCount > 0) return t('sync.failed', { count: status.value.failedCount })
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
            placement="right-center"
            :transparent="true"
            @open="handleOpen"
            @close="handleClose"
        >
            <!-- 轨道按钮：可访问名走 aria-label（C13，tooltip 不能当可访问名），展开态走 trigger slot 的 visible -->
            <template #trigger="{ trigger, visible }">
                <nue-tooltip :content="t('sync.title')" placement="top-center" size="small">
                    <nue-button
                        class="sync-rail-btn"
                        :class="statusTheme"
                        theme="pure"
                        icon="refresh"
                        :loading="syncing"
                        :aria-label="t('sync.title')"
                        :aria-expanded="visible"
                        @click="trigger"
                    />
                </nue-tooltip>
            </template>
            <!-- 内容行：@open 渲染 / @close 移除（C9）；面板根是库内 <ul>，故每行均为 <li> -->
            <template v-if="panelOpen">
                <li class="sync-panel__row">
                    <nue-text size="xs">{{ lastSyncText }}</nue-text>
                </li>
                <li v-if="status.pendingCount > 0" class="sync-panel__row">
                    <nue-text size="xs">
                        {{ t('sync.pending', { count: status.pendingCount }) }}
                    </nue-text>
                </li>
                <li v-if="status.failedCount > 0" class="sync-panel__row is-failed">
                    <nue-text size="xs">{{
                        t('sync.failed', { count: status.failedCount })
                    }}</nue-text>
                </li>
                <li v-if="status.lastError" class="sync-panel__row is-failed">
                    <!-- 全文仅经 title 与文本插值输出（禁 v-html）；2 行截断由 CSS 完成；
                         live region 只播摘要（见下方常驻活动区域），此处不带 aria-live -->
                    <nue-text
                        class="sync-panel__error"
                        size="xs"
                        :clamped="2"
                        :title="status.lastError"
                        >{{ status.lastError }}</nue-text
                    >
                </li>
            </template>
            <!--
              常驻结构位（非内容、无文案/无图标、非 nue-dropdown-item）：default slot 全为注释时，
              Vue 3.5.41 renderSlot + ensureValidVNode 判定“无有效内容”→ 回落库内
              <span class="nue-dropdown__empty-text">无选项</span>（非法 HTML + 噪音文案，C12）。
              故保留一个空 <li> 结构位；内容（信息行 + 按钮）仍全部由 @open/@close 门控（C9）。
            -->
            <!--
              【skill 偏离留痕｜ADR §5】本面板信息行与 footer 用原生 <li> 而非 <nue-dropdown-item>：
              nue-ui 1.10.58 与 1.11.0 的 NueDropdownItem 渲染均为 <li data-executeid onClick>，
              无 tabindex / role / keydown（两版逐文件核对，见 ADR §2 D-4 源码级等价表）→ 键盘不可达，
              无法承载 AC-03「Tab 进 footer 按钮 → Enter 触发」。skill 条目语境是菜单选项
              （execute-id + closeWhenExecuted）；本轮 footer 是动作按钮且按 C15 不挂 execute-id。
              行为等价子集内合法：不给控件补 role="menu"/"menuitem"，不给只读行套 item。
            -->
            <li class="sync-panel__footer">
                <nue-button
                    v-if="panelOpen"
                    theme="primary,small"
                    :loading="manualSyncing"
                    @click="runManualSync"
                >
                    {{ t('sync.syncNow') }}
                </nue-button>
            </li>
        </nue-dropdown>
        <!--
          常驻读屏活动区域（NFR「只播摘要」）：只播同步中/失败计数摘要，**不含** lastError 全文。
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
    line-height: 1;
}

/* D2：修正状态色令牌（原 --warning-color 是局部分组令牌、--nue-danger-hsl-color 全仓无定义） */
.sync-rail-btn.is-pending {
    --nue-button-color: var(--nue-warning-color-60);
}

.sync-rail-btn.is-failed {
    --nue-button-color: var(--nue-error-color-60);
}

/* 信息行（<li> 由本组件渲染，scoped 生效；面板根 <ul> 由库渲染，另见下方非 scoped 块） */
.sync-panel__row {
    color: var(--nue-secondary-text-color);
}

.sync-panel__row.is-failed {
    color: var(--nue-error-color-60);
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
}
</style>