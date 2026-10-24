<script setup lang="ts">
/**
 * SHELL-01 设置对话框（桌面端 + T521 抽屉窄屏）
 * @description **T535：内容重排为 4 类信息架构**（账户 / 外观与语言 / 提醒 / 数据与关于）。
 *              桌面（>445px）= 左栏分类导航（图标 + 名称 + 一行说明） + 右侧分类面板；
 *              窄屏（≤445px）= 顶部 4 段分段切换（`segmented-switch`，2 字标签） + 单列面板。
 *              两套布局**同源**（同一 `categories`、同一 `activeCategoryId`）且**互斥**渲染。
 *
 *              面板内的设置行契约（`data-setting-id` 等钩子）见
 *              `docs/prds/2026-10-24-settings-ia.md` §七（AC1–AC3 / AC6–AC10），用例即契约。
 * @see docs/prds/2026-10-24-settings-ia.md
 */

import { computed, inject, onMounted, onUnmounted, provide, ref } from 'vue'
import { useAuthUseCase, useUserUseCase } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { t } from '@nao-todo/shared/locales'
import SegmentedSwitch from '@/components/calendar/segmented-switch.vue'
import AccountPanel from '../panels/account-panel.vue'
import AppearancePanel from '../panels/appearance-panel.vue'
import DataPanel from '../panels/data-panel.vue'
import ReminderPanel from '../panels/reminder-panel.vue'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import { bindSettingsDialogHost, open, unbindSettingsDialogHost } from './state'

defineOptions({ name: 'SettingsDialog' })

type SettingsCategoryId = 'account' | 'appearance' | 'reminder' | 'data'

/** 4 类信息架构：**顺序即展示顺序**（左栏 / 窄屏段 / 面板三者同源，禁各自维护清单） */
const categories = [
    {
        id: 'account',
        icon: 'account',
        nameKey: 'settings.ia.account.name',
        shortKey: 'settings.ia.account.name',
        descKey: 'settings.ia.account.desc',
        component: AccountPanel
    },
    {
        id: 'appearance',
        icon: 'theme',
        nameKey: 'settings.ia.appearance.name',
        shortKey: 'settings.ia.appearance.short',
        descKey: 'settings.ia.appearance.desc',
        component: AppearancePanel
    },
    {
        id: 'reminder',
        icon: 'ring',
        nameKey: 'settings.ia.reminder.name',
        shortKey: 'settings.ia.reminder.name',
        descKey: 'settings.ia.reminder.desc',
        component: ReminderPanel
    },
    {
        id: 'data',
        icon: 'drive',
        nameKey: 'settings.ia.data.name',
        shortKey: 'settings.ia.data.short',
        descKey: 'settings.ia.data.desc',
        component: DataPanel
    }
] as const

// @state 当前分类（默认第一类：账户；切换即卸载重建，面板内状态随分类复位）
const activeCategoryId = ref<SettingsCategoryId>('account')
const activeCategory = computed(
    () => categories.find((category) => category.id === activeCategoryId.value) ?? categories[0]
)

// @contexts（仅 UI/服务；业务依赖下方本地组装——与原 settings-view 同构）
const { appSubscriber, appDialogManager, isDisplayAside, isUseFloatAside, switchDisplayAside } =
    inject(INDEX_VIEW_CONTEXT_KEY)!

/**
 * @computed 窄屏形态（T521 形态 A）
 * @description 直接复用 Float 变体判定（`useResponsiveAside(MOBILE)`，阈值 445px 定义在 shared hooks）
 *              ⇒ 与抽屉变体**同时切换**，本文件不出现断点数字。桌面 / Electron 恒 false。
 */
const isNarrow = computed(() => isUseFloatAside.value)

/**
 * @computed 窄屏 4 段入口（T521-R1 单一来源件）
 * @description 标签取 2 字短键（账户 / 外观 / 提醒 / 数据）⇒ 320px 档四段等分不裁字；
 *              `testId` 与桌面 tab 的 `data-settings-nav` 同值（用例按名择一匹配）。
 */
const segmentedItems = computed(() =>
    categories.map((category) => ({
        value: category.id,
        label: t(category.shortKey),
        testId: `settings-nav-${category.id}`
    }))
)

// @method 分段切换回写当前分类（件内上抛 string，收窄回分类键）
const setActiveCategory = (value: string): void => {
    activeCategoryId.value = value as SettingsCategoryId
}

// @method 左栏 tab 点击
const selectCategory = (id: SettingsCategoryId): void => {
    activeCategoryId.value = id
}

// @stores/@usecases
const userStore = useUserStore()
const userUseCase = useUserUseCase(userStore)
const authUseCase = useAuthUseCase(userStore)

// @provide Settings 上下文（分类面板注入依赖不变）
provide(SETTINGS_VIEW_CONTEXT_KEY, {
    authUseCase,
    userUseCase,
    subscriber: appSubscriber,
    dialogManager: appDialogManager,
    isDisplayAside,
    isUseFloatAside,
    switchDisplayAside
})

// @host 置位（桌面宿主在屏才允许命令/齿轮开启；卸载复位防残留）
onMounted(bindSettingsDialogHost)
onUnmounted(unbindSettingsDialogHost)
</script>

<template>
    <nue-dialog v-model="open" theme="large,settings" :title="t('nav.settings')">
        <!--
          T521-R4：**窄屏标识必须挂在这层自己的 wrapper 上，不能写在 `<nue-dialog :class>`**。
          NueDialog 内部用 `normalizeClass(['nue-dialog', ...theme])` **重新组装** class，且组件根为
          `<Teleport>`（非元素）⇒ 外部传入的 class 会被丢弃（jsdom 实测：窄屏时
          `.nue-dialog.classList` 里没有 `is-narrow`），挂在 dialog 上的窄屏选择器全是死代码。
          本 wrapper 同时是布局载体：桌面 row（左栏 + 面板）、窄屏 column（段在上 / 面板在下）。
        -->
        <div class="sd-body" :class="{ 'is-narrow': isNarrow }">
            <!-- 两套导航同源互斥：窄屏 = 单一来源件 segmented-switch（4 段等分 / 纯文字 / group+aria-pressed）；
                 桌面 = 左栏竖排 tablist。同一时刻只渲染一套（不得两套语义并存）。 -->
            <segmented-switch
                v-if="isNarrow"
                :items="segmentedItems"
                :model-value="activeCategoryId"
                :fill="true"
                size="md"
                :aria-label="t('settings.ia.navLabel')"
                @update:model-value="setActiveCategory"
            />
            <div
                v-else
                class="sd-tabs"
                role="tablist"
                aria-orientation="vertical"
                :aria-label="t('settings.ia.navLabel')"
            >
                <div v-for="category in categories" :key="category.id" class="sd-tabs__item">
                    <button
                        type="button"
                        class="sd-tab"
                        :class="{ 'is-active': category.id === activeCategoryId }"
                        role="tab"
                        :aria-selected="category.id === activeCategoryId"
                        :data-settings-nav="category.id"
                        @click="selectCategory(category.id)"
                    >
                        <nue-icon :name="category.icon" size="1rem" />
                        <span class="sd-tab__name">{{ t(category.nameKey) }}</span>
                    </button>
                    <span class="sd-tabs__desc" data-settings-desc>{{ t(category.descKey) }}</span>
                </div>
            </div>
            <!-- 右侧 / 下方：当前分类面板（外框定尺，仅本区内部滚动） -->
            <div class="sd-panel">
                <component :is="activeCategory.component" :key="activeCategoryId" />
            </div>
        </div>
    </nue-dialog>
</template>

<style>
/* 对话框宿主级样式（NueDialog 传送至 body 弹层池，需非 scoped） */
/* 外框定尺：仅随视口变化，切分类/内容增减不变（SHELL-04） */
.nue-dialog--settings {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.nue-dialog--settings > .nue-dialog__main {
    flex: 1;
    min-height: 0;
    display: flex;
}

/* 左右分栏：左栏固定，右栏内容区内部滚动 */
.nue-dialog--settings .nue-dialog__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    overflow: hidden;
}

/* ===== 布局载体（窄屏标识落点）：桌面 = row（左栏 13rem + 面板 flex:1）；
   窄屏 = column（段在上 / 面板在下）。`min-width: 0` 防面板 min-content 撑宽出视口。 ===== */
.sd-body {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: row;
}

.sd-body.is-narrow {
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

.sd-body.is-narrow .sd-panel {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0;
}

.sd-body.is-narrow .sd-row {
    padding: var(--nue-padding-xs);
}

/* 叶子自带内边距的行（用户信息）在窄屏也不叠加行内边距：同类名数下靠后者覆盖 */
.sd-body.is-narrow .sd-row--flush {
    padding: 0;
}

/* ===== 左栏分类导航：竖排、定宽不收缩 ===== */
.sd-tabs {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    flex: none;
    width: 13rem;
    padding: 0 var(--nue-padding-sm) 0 0;
    border-right: 1px solid var(--nue-border-color);
    overflow: auto;
}

.sd-tabs__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sd-tab {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    width: 100%;
    /* 点击区 ≥44px；名称允许两行时随之增高（英文长分类名不截断） */
    min-height: 2.75rem;
    padding: var(--nue-padding-2xs) var(--nue-padding-sm);
    border: 1px solid transparent;
    border-radius: var(--nue-primary-radius);
    background: transparent;
    color: var(--nue-primary-color-700);
    font: inherit;
    font-size: var(--nue-text-sm);
    text-align: left;
    cursor: pointer;
}

.sd-tab:hover {
    background: var(--nue-primary-color-100);
    color: var(--nue-primary-color-900);
}

.sd-tab:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

/* 选中态三重可辨：表面色 + 左侧强调竖线 + 字重（去色后仍可辨，满足 AGENTS.md 三态要求） */
.sd-tab.is-active {
    background: var(--nue-primary-color-100);
    box-shadow: inset 2px 0 0 var(--nue-primary-color-600);
    color: var(--nue-primary-color-900);
    font-weight: var(--nue-font-weight-medium);
}

/* 分类名：允许换行（单行省略会让英文长名「Appearance & Language」在 13rem 下被切且无 title）；
   中文 4 项仍在单行内（最长 5 字 ≈ 70px < 可用 ≈ 148px）。按词断行，超长单词才硬断。 */
.sd-tab__name {
    min-width: 0;
    line-height: 1.3;
    overflow-wrap: break-word;
    white-space: normal;
}

/* 图标不参与压缩：名称换行时图标保持 1rem 同轴线 */
.sd-tab .nue-icon {
    flex: none;
}

.sd-tabs__desc {
    padding: 0 var(--nue-padding-sm);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.4;
}

/* ===== 右侧面板：占满剩余宽度，溢出时仅本区滚动 ===== */
.sd-panel {
    flex: 1;
    min-height: 0;
    padding: 0 var(--nue-padding-xs) var(--nue-padding-sm) var(--nue-padding-sm);
    overflow: auto;
}

/* 分类面板：切分类时仅一次淡入（响应式动效，无入场序列；尊重 reduced-motion） */
.sd-cat {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    animation: sd-fade var(--nue-animation-duration-short) ease-out;
}

@keyframes sd-fade {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

/* ===== 分组卡片：1px 边框 + 表面色（无阴影堆叠、无渐变；层级由结构承担） ===== */
.sd-group {
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-0);
    overflow: hidden;
}

.sd-group__head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--nue-padding-sm);
    border-bottom: 1px solid var(--nue-border-color);
}

.sd-group__title {
    margin: 0;
    color: var(--nue-primary-color-900);
    font-size: var(--nue-text-sm);
    font-weight: var(--nue-font-weight-medium);
}

.sd-group__desc {
    margin: 0;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.5;
}

/* ===== 设置行：点击区 ≥44px；行间 1px 细分隔（不画表格网格） ===== */
.sd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-sm);
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
}

.sd-row + .sd-row {
    border-top: 1px solid var(--nue-border-color);
}

.sd-row--stack {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nue-gap-2xs);
}

.sd-row--block {
    display: block;
}

.sd-row--flush {
    padding: 0;
}

.sd-row__line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-sm);
    min-height: 2.5rem;
}

.sd-row__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.sd-row__label {
    color: var(--nue-primary-color-900);
    font-size: var(--nue-text-sm);
}

.sd-row__hint {
    margin: 0;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.5;
}

/* 行内折叠开关：原生 button（键盘可达，Enter/Space 由浏览器承担） */
.sd-row__toggle {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    width: 100%;
    min-height: 2.5rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--nue-primary-color-900);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.sd-row__toggle:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

.sd-row__chevron {
    margin-left: auto;
    color: var(--nue-secondary-text-color);
}

/* 行内动作（次级按钮：外链入口） */
.sd-row__action {
    flex: none;
    box-sizing: border-box;
    min-height: 2.5rem;
    padding: 0 var(--nue-padding-sm);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background: transparent;
    color: var(--nue-primary-color-700);
    font: inherit;
    font-size: var(--nue-text-xs);
    cursor: pointer;
}

.sd-row__action:hover {
    background: var(--nue-primary-color-100);
    color: var(--nue-primary-color-900);
}

.sd-row__action:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

/* ===== 危险区：独立容器 + 与常规区留白 + 危险色；每行 = 图标 + 文本 + 危险色（三重冗余） ===== */
.sd-group--danger {
    margin-top: var(--nue-gap-md);
    border-color: var(--nue-error-color-40);
}

.sd-group--danger .sd-group__title {
    color: var(--nue-error-color-90);
}

.sd-danger-row {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    width: 100%;
    min-height: 2.75rem;
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border: 0;
    background: transparent;
    color: var(--nue-error-color-90);
    font: inherit;
    font-size: var(--nue-text-sm);
    text-align: left;
    cursor: pointer;
}

.sd-danger-row + .sd-danger-row {
    border-top: 1px solid var(--nue-border-color);
}

.sd-danger-row:hover {
    background: var(--nue-error-color-10);
}

.sd-danger-row:focus-visible {
    outline: 2px solid var(--nue-error-color-60);
    outline-offset: -2px;
}

.sd-danger-row:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* ===== 免打扰时段输入（原生 time 控件，沿用 v1.12.16 视觉） ===== */
.sd-quiet-hours {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nue-gap-sm);
}

.sd-quiet-hours__field {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    min-width: 8rem;
}

.sd-quiet-hours__field input {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.5rem;
    padding: 0 var(--nue-padding-xs);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background-color: transparent;
    color: var(--nue-primary-color-800);
    font-family: inherit;
    font-size: var(--nue-text-sm);
    outline: none;
}

.sd-quiet-hours__field input:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

/* ===== 提醒权限一次性说明（可关闭的引导块） ===== */
.sd-permission-notice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-100);
}

@media (prefers-reduced-motion: reduce) {
    .sd-cat {
        animation: none;
    }
}
</style>