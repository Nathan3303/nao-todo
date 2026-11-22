<script setup lang="ts">
/**
 * SHELL-01 设置对话框（桌面端 + T521 抽屉窄屏）
 * @description **T535：内容重排为 4 类信息架构**（账户 / 外观与语言 / 提醒 / 数据与关于）。
 *              桌面（>445px）= 左栏分类导航（R2：只留图标 + 名称） + 右侧分类面板
 *              （每类的一句说明由右侧组头承载，信息只迁移、不丢失）；
 *              窄屏（≤445px）= 顶部 4 段分段切换（`segmented-switch`，2 字标签） + 单列面板。
 *              两套布局**同源**（同一 `categories`、同一 `activeCategoryId`）且**互斥**渲染。
 *
 *              面板内的设置行契约（`data-setting-id` 等钩子）见
 *              `docs/prds/2026-10-24-settings-ia.md` §七（AC1–AC3 / AC6–AC10），用例即契约。
 * @see docs/prds/2026-10-24-settings-ia.md
 */

import { computed, inject, onMounted, onUnmounted, provide, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAuthUseCase, useUserUseCase } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { t } from '@nao-todo/shared/locales'
import { SegmentedSwitch } from '@nao-todo/shared/components/segmented-switch'
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
        component: AccountPanel
    },
    {
        id: 'appearance',
        icon: 'theme',
        nameKey: 'settings.ia.appearance.name',
        shortKey: 'settings.ia.appearance.short',
        component: AppearancePanel
    },
    {
        id: 'reminder',
        icon: 'ring',
        nameKey: 'settings.ia.reminder.name',
        shortKey: 'settings.ia.reminder.name',
        component: ReminderPanel
    },
    {
        id: 'data',
        icon: 'drive',
        nameKey: 'settings.ia.data.name',
        shortKey: 'settings.ia.data.short',
        component: DataPanel
    }
] as const

// @state 当前分类（默认第一类：账户；切换即卸载重建，面板内状态随分类复位）
const activeCategoryId = ref<SettingsCategoryId>('account')

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

/** tab / tabpanel 的 DOM id（`aria-controls` 与 `aria-labelledby` 互指，AC7） */
const tabIdOf = (id: SettingsCategoryId): string => `settings-tab-${id}`
const panelIdOf = (id: SettingsCategoryId): string => `settings-panel-${id}`

// @refs 左栏 tab 元素（键盘切换后焦点跟跟随；`v-for` 函数 ref）
const tabEls: HTMLElement[] = []
const setTabRef = (el: Element | ComponentPublicInstance | null, index: number): void => {
    if (el instanceof HTMLElement) tabEls[index] = el
}

/**
 * 左栏 tab 键盘切换（PRD R5 / AC7）
 * @description `↑/↓` 前后切分类（循环），`Home/End` 跳首/末；切换后 `aria-selected` 与新 tab 的
 *              **焦点同步**（禁只换内容不换焦点）。窄屏走 `segmented-switch` 自己的键盘语义，不受影响。
 */
const onTabKeydown = (event: KeyboardEvent, index: number): void => {
    const last = categories.length - 1
    let next: number
    if (event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    activeCategoryId.value = categories[next]!.id
    tabEls[next]?.focus()
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
                <button
                    v-for="(category, index) in categories"
                    :id="tabIdOf(category.id)"
                    :key="category.id"
                    type="button"
                    class="sd-tab"
                    :class="{ 'is-active': category.id === activeCategoryId }"
                    role="tab"
                    :aria-selected="category.id === activeCategoryId"
                    :aria-controls="panelIdOf(category.id)"
                    :data-settings-nav="category.id"
                    :ref="(el) => setTabRef(el, index)"
                    @click="selectCategory(category.id)"
                    @keydown="onTabKeydown($event, index)"
                >
                    <nue-icon :name="category.icon" size="1rem" />
                    <span class="sd-tab__name">{{ t(category.nameKey) }}</span>
                </button>
            </div>
            <!-- 右侧 / 下方：当前分类面板（外框定尺，仅本区内部滚动）。
                 4 个面板壳恒在（非当前项 `hidden`），但**只有当前项渲染内容**
                 （其它类的设置行不得同时存在，AC1/AC7）。
                 DEF-83：面板语义**随形态切换、同一时刻只有一套** ——
                 桌面（真 `tablist`/`tab`）⇒ `role=tabpanel` + `aria-labelledby` 回指 tab id；
                 窄屏（`segmented-switch`，无 tab 语义）⇒ `role=group` + `aria-label`（分类名），
                 **不得**留悬空 `aria-labelledby`（窄屏无 tab id ⇒ 读屏拿不到面板名）。 -->
            <div class="sd-panel">
                <div
                    v-for="category in categories"
                    :id="panelIdOf(category.id)"
                    :key="category.id"
                    :role="isNarrow ? 'group' : 'tabpanel'"
                    :aria-label="isNarrow ? t(category.nameKey) : undefined"
                    :aria-labelledby="isNarrow ? undefined : tabIdOf(category.id)"
                    :hidden="category.id !== activeCategoryId"
                >
                    <component
                        :is="category.component"
                        v-if="category.id === activeCategoryId"
                        :key="activeCategoryId"
                    />
                </div>
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

/* 窄屏只多一条「段 ↔ 面板」间距（#360）：块内块外台阶与宽档**不分叉** ——
   窄档不另开一套 padding / gap 副本（旧版三条覆盖 + `.sd-cat { gap: 2rem }` 已删，AC4/AC7）。 */
.sd-body.is-narrow {
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

.sd-body.is-narrow .sd-panel {
    flex: 1 1 auto;
    min-height: 0;
}

/* ===== 间距台阶（#360 AC4）：每层一个唯一来源，取值全部来自 `--nue-*`
   L0 对话框外边距 = `--nue-padding-df`（`.nue-dialog` 主题 padding；本文件 ⛔ 不再叠加）
   L1 栏间        = `--nue-padding-md`（`.sd-tabs` 的 `padding-inline-end`）
   L2 块 ↔ 块     = `--nue-gap-lg`（`.sd-cat` 的 gap；组内子块 = `.sd-subblock`）
   L3 组头 ↔ 首行  = `--nue-padding-df`（`.sd-group__head` 的 `margin-bottom` + 所在容器的行 gap）
     组头内 标题 ↔ 说明 = `--nue-gap-2xs`
   L4 行 ↔ 行     = `--nue-padding-xs`（`.sd-group` 的 gap；行自身 `padding-block: 0`）
   L5 行内        = `--nue-gap-xs`（横向）/ `--nue-gap-2xs`（纵向）
   L6 分区内元素   = `--nue-padding-sm`（有底色块的内边距，如密码块）
   块内水平内缩（横轴）= `--nue-padding-sm`，唯一来源 `.sd-group` 的 `padding-inline`
   ⚠️ 只有「容器已带行 gap」的两处用 `calc(目标 − 行 gap)` 补齐（组头、子块）—— 全文件仅此两处，
      目标值仍由上面的唯一 token 决定；⛔ 不再逐块叠加内边距（旧版四层双层内边距已删）。 */

/* ===== 左栏分类导航：竖排、定宽不收缩；每项 = 图标 + 名称（R2：副文本说明移到右侧组头） ===== */
.sd-tabs {
    display: flex;
    flex-direction: column;
    /* 只剩「图标 + 名称」一行 ⇒ 项间距取 xs（保持紧凑工具轨、又不黏成一块） */
    gap: var(--nue-gap-xs);
    flex: none;
    width: 13rem;
    /* L1：与右侧面板的间距（唯一来源；面板侧 ⛔ 不再自己加左内边距） */
    padding-inline-end: var(--nue-padding-md);
    overflow: auto;
}

/* 左栏项 = `nue-link--route` 的既有四态（#360 AC1：**无左侧竖线**，靠深填充 + 字重表达激活）。
   四态取值逐条对齐 `nue-ui-theme-shadlike` 的 `.nue-link--route` + 本仓 `themes/link.css` 的焦点环：
   透明 → hover `-200`（文字不变色）→ 激活 `-900` 底 + `-0` 字 + 600 → focus 环 `-600` + offset 2。 */
.sd-tab {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    width: 100%;
    /* 行级命中区 ≥40px；⛔ 不用固定 height（英文长分类名两行时随之长高，AC8） */
    min-height: var(--nue-box-size-md);
    padding-block: var(--nue-gap-2xs);
    padding-inline: var(--nue-padding-sm);
    border: 0;
    border-radius: var(--nue-primary-radius);
    background: transparent;
    color: var(--nue-primary-text-color);
    font: inherit;
    font-size: var(--nue-text-sm);
    text-align: left;
    cursor: pointer;
}

/* hover 只换底、不换字色（不靠变色传达 hover） */
.sd-tab:hover {
    background: var(--nue-primary-color-200);
}

.sd-tab:focus-visible {
    outline: 2px solid var(--nue-primary-color-600);
    outline-offset: 2px;
}

/* 选中态两通道（深填充 + 字重）+ 语义通道（`aria-selected`）：去色后仍可辨；⛔ 无竖线 / 无描边 */
.sd-tab.is-active {
    background: var(--nue-primary-color-900);
    color: var(--nue-primary-color-0);
    font-weight: 600;
}

/* 分类名：允许换行（单行省略会让英文长名「Appearance & Language」在 13rem 下被切且无 title）；
   中文 4 项仍在单行内（最长 5 字 ≈ 70px < 可用 ≈ 140px）。按词断行，超长单词才硬断。 */
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

/* ===== 右侧面板：平铺（无卡片、无边框），仅本区滚动。
   ⛔ 无自身内边距（L0 由 `.nue-dialog` 的 `--nue-padding-df` 唯一承担；旧版 `12/20/24/40` 双层内边距已删） ===== */
.sd-panel {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

/* 分类面板：块与块之间只用留白分隔（L2 = 24）；切分类仅一次淡入（尊重 reduced-motion） */
.sd-cat {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-lg);
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

/* ===== 分组：完全平铺（无边框 / 无底色 / 无圆角 / 无内边距盒）
   L4：组内「行 ↔ 行」间距**唯一来源** = 这里的 gap；行自身 `padding-block: 0`（旧版 8+8 叠成 16 已删）。
   块内水平内缩**唯一来源** = `padding-inline`（旧版 `.sd-group__head` / `.sd-row` 各自的 12px 已删）。 ===== */
.sd-group {
    display: flex;
    flex-direction: column;
    gap: var(--nue-padding-xs);
    padding-inline: var(--nue-padding-sm);
}

/* 组内子块（L2）：与上一块的间距取「块 ↔ 块」档（24）；
   减去所在 `.sd-group` 已提供的行 gap（8）⇒ 实际块间距 = 24（AC3 / AC4）。 */
.sd-subblock {
    margin-top: calc(var(--nue-gap-lg) - var(--nue-padding-xs));
}

/* 密码常驻分区（#360 AC3 / T752 B 方案）：本面板**刻意没有**密码块级规则 ——
   **无底色 / 无内边距 / 无圆角**，分区重量只由「组头字阶（20 vs 14）+ 块间距（24）」两通道承担；
   块内字段间距沿用组件原生（`nue-div` / `form-item`，定义处 `presentation-identity`）。
   ⛔ 不回加 `-100` 浅底 / 描边 / 阴影 / 字号特例（一个区块只加一处重量）；
   无底色后表单 label 回 `--nue-primary-color-600`（白底 5.74 ✓），不再覆写 `-700`。 */

/* 组头：大字号标题 + 一行说明；与首行之间 L3 = 16（去掉所在容器已提供的行 gap 后补足） */
.sd-group__head {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin-bottom: calc(var(--nue-padding-df) - var(--nue-padding-xs));
}

.sd-group__title {
    margin: 0;
    color: var(--nue-primary-color-900);
    /* 20px（行标签 14px）⇒ 标题与行的层级一眼可辨 */
    font-size: var(--nue-text-lg);
    font-weight: 600;
    line-height: 1.3;
}

.sd-group__desc {
    margin: 0;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.5;
}

/* 组头右侧动作（T754：账户「登录设备」的刷新按钮，用户要求与分区主标题同一行）：
   仅本分区用 `--actions` 修饰符 ⇒ **其余三分区组头形态零变化**（仍是上面那条纵排规则）。
   布局：标题/动作同一行（动作钉在标题行起点 ⇒ `rect.top` 与标题同基线）、副标题占满下方一行；
   动作列 `auto` ⇒ 按钮右缘与组头内容右缘对齐（横轴内缩仍只由 `.sd-group` 的 `padding-inline` 提供）。 */
.sd-group__head--actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
        'title actions'
        'desc actions';
    /* 标题 ↔ 动作 = 8（L5 行内横向档 `--nue-gap-xs`；本仓主题下 `--nue-gap-sm` 为 12，取值以 8 为准） */
    column-gap: var(--nue-gap-xs);
    align-items: start;
}

.sd-group__head--actions > .sd-group__title {
    grid-area: title;
}

.sd-group__head--actions > .sd-group__desc {
    grid-area: desc;
}

.sd-group__head--actions > .sd-group__head-action {
    grid-area: actions;
}

/* ===== 设置行：不画分隔线，靠行高 + 组内 gap 区分（L4）
   行自身 ⛔ 无 `padding-block`（纵向间距由 `.sd-group` 的 gap 唯一承担）、⛔ 无 `padding-inline`
   （横轴由 `.sd-group` 的 `padding-inline` 唯一承担）⇒ 文本统一落在同一左轴线。 ===== */
.sd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* L5 行内横向（标签 ↔ 控件）= 8 */
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    min-height: var(--nue-box-size-md);
}

.sd-row--stack {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nue-gap-xs);
}

.sd-row--block {
    display: block;
}

.sd-row__line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-xs);
    min-height: var(--nue-box-size-md);
}

/* L5：行内纵向 标签 ↔ 说明 = 4 */
.sd-row__text {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
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

/* 行内折叠开关：原生 button（键盘可达）；hover/focus 用轻微底色，不画线。
   hover 面用「负内缩 + 等量内边距」铺满组内容宽，文字仍落在 28px 左轴线（净位移 0）。 */
.sd-row__toggle {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    box-sizing: border-box;
    min-height: var(--nue-box-size-md);
    margin-inline: calc(var(--nue-padding-sm) * -1);
    padding-inline: var(--nue-padding-sm);
    border: 0;
    border-radius: var(--nue-primary-radius);
    background: transparent;
    color: var(--nue-primary-color-900);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.sd-row__toggle:hover {
    background: var(--nue-primary-color-100);
}

.sd-row__toggle:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

.sd-row__chevron {
    margin-left: auto;
    color: var(--nue-secondary-text-color);
}

/* 行内动作（次级按钮：外链入口）——用底色区分，不用描边 */
.sd-row__action {
    flex: none;
    box-sizing: border-box;
    min-height: var(--nue-box-size-md);
    padding: 0 var(--nue-padding-sm);
    border: 0;
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-100);
    color: var(--nue-primary-color-800);
    font: inherit;
    font-size: var(--nue-text-xs);
    cursor: pointer;
}

.sd-row__action:hover {
    background: var(--nue-primary-color-200);
    color: var(--nue-primary-color-900);
}

.sd-row__action:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 1px;
}

/* ===== 危险区：无边框容器 ⇒ 区块标题 + 动作区 + 错误色 + 位置次序（多重可辨）
   ⛔ 无自身 `margin-top`：与上方块的间距 = `.sd-cat` 的 L2（唯一来源，旧版 44+24 叠成 68px 已删） ===== */
.sd-group--danger .sd-group__title {
    color: var(--nue-error-color-90);
}

/* 危险动作区（T754 用户第三轮）：两个动作收进**一个** `nue-div`（flex row、间距 8 = 本主题的
   `--nue-gap-xs`，窄屏 wrap 不溢出）并改用库 `nue-button` ⇒ 本文件**不再**有自绘危险行规则
   （旧 `.sd-danger-row` 的 hover/focus/disabled 三套手写态由主题原生四态接管）。
   点击区保持改前的 40（`--nue-box-size-md`，AGENTS 界面原则 §2「更大点击区」），
   ⛔ 不改文案 / 次序 / 二次确认流程。 */
.sd-danger-actions .nue-button {
    min-height: var(--nue-box-size-md);
}

/* 待注销态的危险区末行（#360 AC6）：数据删除时间 = 停用日 − 7 天。
   取 `--nue-error-color-90`（白底 8.97 ✓，与危险区标题同档）；不满足条件时整行不渲染（AC5）。 */
.sd-deletion-deadline {
    color: var(--nue-error-color-90);
    font-size: var(--nue-text-sm);
    line-height: 1.5;
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
    min-height: var(--nue-box-size-md);
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

/* ===== 提醒权限一次性说明（可关闭的引导块；底色区分，不用描边） ===== */
.sd-permission-notice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-100);
}

/* ===== 桌面常驻：状态行三重可辨（颜色 + 符号 + 文字；去色后仍靠符号与文字区分） ===== */
.sd-desktop-status {
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    min-width: 0;
    font-size: var(--nue-text-sm);
    line-height: 1.5;
}

.sd-desktop-status__symbol {
    flex: none;
    /* 符号宽度对齐：`– … ↑ ✓ ×` 字形宽不一 ⇒ 不给定宽时右侧文字逐态左右跳（v4 顺带修好本行同类跳动） */
    min-width: 1em;
    text-align: center;
    font-weight: 700;
}

.sd-desktop-status.is-ok {
    color: var(--nue-success-color-100);
}

.sd-desktop-status.is-warn {
    color: var(--nue-warning-color-90);
}

.sd-desktop-status.is-error {
    color: var(--nue-error-color-90);
}

/* 无结论的中性态（idle / checking / downloading / unsupported）：-700 压 -100 底 = 6.77 ✓ */
.sd-desktop-status.is-muted {
    color: var(--nue-primary-color-700);
}

/* 行内仅右对齐一个动作（如「退出 NaoTodo」） */
.sd-row--end {
    justify-content: flex-end;
}

@media (prefers-reduced-motion: reduce) {
    .sd-cat {
        animation: none;
    }
}
</style>