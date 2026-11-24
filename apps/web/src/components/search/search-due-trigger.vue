<script lang="ts" setup>
import { computed } from 'vue'
import { t, getLocale } from '@nao-todo/shared/locales'
import { dateKeyOfIso, isDueRangeActive, normalizeDateKey } from './search-sort'
import FilterTriggerLabel from './filter-trigger-label.vue'

/**
 * 搜索「截止日区间」触发器（T770）
 * @description 与筛选栏既有触发器同风格；面板内为起/止两个日期（可单边、可清空）+「包含无截止日」
 *              开关（与「包含已归档」同风格）。状态由引擎持有，本组件 props 驱动、仅上抛。
 *              日期取值口径 = `NueDatePicker type="date"` 的 `YYYY-MM-DD`（本地自然日，闭区间）。
 *
 *              面板骨架与样式**逐值复刻**任务详情面板的日期选择器
 *              （`packages/presentation/task/components/date-selector/task-date-selector.vue`）
 *              + 提醒设置器的开关行（`.../remind-setter/task-remind-setter.vue`）—— 用户口径：
 *              「直接读任务详情面板日期选择的布局和样式，然后复写，数据逻辑不变」。
 *              ⛔ 不复用那两个组件：值域是 ISO datetime、内含提醒区、且是「取消/保存」提交式；
 *              筛选是自然日 `YYYY-MM-DD` + 即时生效。
 */

defineOptions({ name: 'SearchDueTrigger' })

const props = defineProps<{
    from: string
    to: string
    includeNoDue: boolean
}>()

const emit = defineEmits<{
    (e: 'update:from', value: string): void
    (e: 'update:to', value: string): void
    (e: 'update:includeNoDue', value: boolean): void
    (e: 'clear'): void
}>()

/**
 * 日期键 → 本地化短文案（`3/1`；仅用于触发器摘要，不参与筛选计算）
 *
 * @description **绝不抛错**（`T795` 复盘 / #398 二轮）：曾被 `Intl.DateTimeFormat().format(Invalid Date)`
 *              的 `RangeError` 打断渲染（脏日期键 ⇒ 整颗触发器只剩注释、宽度塌成 padding）。
 *              现改为**纯字符串解析 + i18n 文案**（不再调用 `Intl`）⇒ 结构上不存在抛错面；
 *              规整失败即回退原串展示。
 */
const shortLabel = (key: string, options: { withYear?: boolean } = {}): string => {
    const normalized = dateKeyOfIso(key) || normalizeDateKey(key)
    if (normalized === '') return key
    const [year, month, day] = normalized.split('-').map(Number)
    // 走项目既有 i18n 日期文案（zh `11月1日` / en `11/1`），⛔ 不用浏览器 Intl 的自有格式
    // （会得到 `2025/11/1`，与全站 `2025年11月1日` 风格不一致；也不用相对日期工具 —— 它带时刻且随当前时间漂移）。
    return options.withYear
        ? t('date.yearMonthDay', { year: year ?? 1970, month: month ?? 1, day: day ?? 1 })
        : t('date.monthDay', { month: month ?? 1, day: day ?? 1 })
}

/** 日期键的年份（无法解析 ⇒ `null`） */
const yearOf = (key: string): number | null => {
    const normalized = dateKeyOfIso(key) || normalizeDateKey(key)
    if (normalized === '') return null
    const year = Number(normalized.slice(0, 4))
    return Number.isFinite(year) ? year : null
}

/**
 * 是否需要显示年份（`#398` 三轮 · 用户实报）
 *
 * @description 省略年份在**跨年**时会造成误读：`2025-11-01` 至 `2026-09-08` 只显示
 *              「11/1 至 9/8」时，读者会以为起点晚于终点。规则：
 *              ① 两端年份不同 ⇒ **两端都带年份**；
 *              ② 任一端不是当前年 ⇒ 该端带年份（避免"去年 11/1"被读成今年）；
 *              ③ 都在当前年 ⇒ 保持紧凑，只显示 `M/D`。
 */
const needYear = (from: string, to: string): { from: boolean; to: boolean } => {
    const currentYear = new Date().getFullYear()
    const fromYear = yearOf(from)
    const toYear = yearOf(to)
    if (fromYear !== null && toYear !== null && fromYear !== toYear) return { from: true, to: true }
    return {
        from: fromYear !== null && fromYear !== currentYear,
        to: toYear !== null && toYear !== currentYear
    }
}

/** 区间摘要（双端 / 单边 / 未设置三态） */
const rangeText = computed(() => {
    const { from, to } = props
    const year = needYear(from, to)
    if (from !== '' && to !== '')
        return t('search.filter.dueRange', {
            from: shortLabel(from, { withYear: year.from }),
            to: shortLabel(to, { withYear: year.to })
        })
    if (from !== '')
        return t('search.filter.dueFromOnly', { from: shortLabel(from, { withYear: year.from }) })
    if (to !== '')
        return t('search.filter.dueToOnly', { to: shortLabel(to, { withYear: year.to }) })
    return ''
})

const selectedItem = computed(() =>
    rangeText.value === '' ? [] : [{ id: 'due', name: rangeText.value }]
)
const active = computed(() => isDueRangeActive({ from: props.from, to: props.to }))

/** 日期选择器输出 → 状态值（**恒规整为 `YYYY-MM-DD`**；空 = 该侧不限） */
const toDateKey = (value: string | null | undefined): string =>
    value ? dateKeyOfIso(value) || normalizeDateKey(value) : ''
const onFrom = (value: string | null | undefined) => emit('update:from', toDateKey(value))
const onTo = (value: string | null | undefined) => emit('update:to', toDateKey(value))
</script>

<template>
    <!-- ⛔ 不加 `theme="menu"`：参考件（任务详情日期选择器）没有它。菜单主题会给 `<ul>` 换成
         `padding: 2px 0`（参考件是基类 `--nue-padding-2xs` 四边）并把分隔线改成
         `width: calc(100% - .5rem)`（参考件是通栏）⇒ 与参考件双重错位。去掉后容器内边距/分隔线
         与参考件一致（PR #404 里有逐项计算值对照）。 -->
    <nue-dropdown
        placement="bottom-start"
        size="small"
        group="search-filter"
        :close-when-executed="false"
    >
        <template #trigger="{ trigger, visible }">
            <nue-button
                :aria-expanded="visible"
                class="filter-trigger"
                :class="{ 'filter-trigger--active': active }"
                theme="small"
                data-role="due-trigger"
                @click="trigger($event)"
            >
                <filter-trigger-label
                    :label="t('search.filter.due')"
                    :items="selectedItem"
                    :title="rangeText"
                />
            </nue-button>
        </template>
        <nue-div vertical class="due-panel">
            <!-- 起 / 止各一行：标签在上（次要色小字）、控件全宽；两行之间也有分隔线（照抄参考件） -->
            <nue-div class="due-panel__row">
                <nue-text size="var(--nue-text-xs)" class="due-panel__label">
                    {{ t('search.filter.dueFrom') }}
                </nue-text>
                <nue-date-picker
                    :model-value="from"
                    type="date"
                    size="small"
                    clearable
                    class="due-panel__picker"
                    :placeholder="t('search.filter.dueFrom')"
                    data-role="due-from"
                    @update:model-value="onFrom"
                />
            </nue-div>
            <nue-divider />
            <nue-div class="due-panel__row">
                <nue-text size="var(--nue-text-xs)" class="due-panel__label">
                    {{ t('search.filter.dueTo') }}
                </nue-text>
                <nue-date-picker
                    :model-value="to"
                    type="date"
                    size="small"
                    clearable
                    class="due-panel__picker"
                    :placeholder="t('search.filter.dueTo')"
                    data-role="due-to"
                    @update:model-value="onTo"
                />
            </nue-div>
            <nue-divider />
            <!-- 无截止日开关：照提醒设置器的行样式（文字在左、开关在右、整行可点）；
                 开关高度也取那一行的 `--nue-switch-height: 1rem`（否则 1.75rem 行里开关几乎顶满）。
                 ⛔ 开关自身的 click 带 `.stop`（nue-ui 内部）⇒ 点开关只走 switch 的分支，
                 不会与整行的 click 各抛一次而互相抵消（三方点击各产生**一次**切换）。 -->
            <nue-div
                class="due-panel__switch-row"
                @click="emit('update:includeNoDue', !includeNoDue)"
            >
                <nue-text class="due-panel__switch-label">
                    {{ t('search.includeNoDue') }}
                </nue-text>
                <nue-switch
                    :model-value="includeNoDue"
                    size="small"
                    style="--nue-switch-height: 1rem"
                    :aria-label="t('search.includeNoDue')"
                    @update:model-value="(value: boolean) => emit('update:includeNoDue', value)"
                />
            </nue-div>
            <!-- 清除动作（参考件的「操作区」位次）：只有一个按钮 ⇒ 左对齐；
                 无筛选值时整组（含分隔线）不出现，避免面板留一条尾巴分隔线 -->
            <template v-if="active">
                <nue-divider />
                <nue-div class="due-panel__actions">
                    <nue-button
                        theme="small,ghost"
                        icon="clear"
                        class="due-panel__clear"
                        @click="emit('clear')"
                    >
                        {{ t('search.filter.dueClear') }}
                    </nue-button>
                </nue-div>
            </template>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped src="./filter-trigger.css"></style>

<style>
/* 截止日筛选面板（`#403` / T755）
 *
 * @description **逐值复刻**任务详情面板的日期选择器（`task-date-selector.vue` 的全局 `<style>`）
 *              ⇒ 选择器前缀换成 `.due-panel*`，声明与取值不改；开关行取 `task-remind-setter.vue`
 *              的 `.nue-div--row` 取值、动作区取面板的 `__actions`（改左对齐）。
 *              ⛔ 全局（非 scoped）：NueDropdown 的内容经 Teleport 渲染至 body，且日期选择器内部
 *              节点（`__trigger` / `__clear` / `.nue-button`）拿不到本组件的 scope id ——
 *              与参考件同一理由（其注释亦写明）。选择器均已用 `.due-panel` 前缀限定，不泄漏。
 */
.due-panel {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    width: 14rem;
    color: var(--nue-primary-color-900);
    padding: var(--nue-padding-2xs) 0;
}

.due-panel__row {
    display: flex;
    flex-direction: column;
    align-items: start;
    justify-content: space-between;
    gap: var(--nue-gap-2xs);
}

/* 标签左缘与控件内文字同缩进（参考件的关键一行：否则标签顶格、控件文字内缩 ⇒ 左边参差） */
.due-panel__row > .nue-text {
    color: var(--nue-primary-color-400);
    flex: none;
    padding: 0 var(--nue-padding-xs);
}

.due-panel__picker {
    width: 100%;
    box-sizing: border-box;
}

/* nue-ui 1.15.x 起触发器外包一层 `width: fit-content` 的 `__trigger`
   ⇒ 内层按钮的 `width:100%` 会收缩为内容宽；此处把包含块拉满整行 */
.due-panel__picker > .nue-date-picker__trigger {
    width: 100%;
}

/* 日期是**无框文本行**（参考件同式）：默认按钮的边框/阴影/内边距会把它画成输入框 */
.due-panel__picker .nue-button {
    width: 100%;
    border: none;
    box-shadow: none;
    padding-block: 0;
    padding-left: var(--nue-padding-xs);
    padding-right: var(--nue-padding-xs);
}

/* DEF-129：清除键是与按钮同级的绝对定位按钮（靠 right 定位），主题靠
   `--clearable .nue-button` 的 padding-right 给它留位；上面若用 padding 简写会把这份预留
   一并清掉 ⇒ 日历图标右移、正好被清除键压住。此处按 `size="small"` 显式恢复主题同式。 */
.due-panel__picker
    .nue-date-picker__trigger--small.nue-date-picker__trigger--clearable
    .nue-button {
    padding-right: calc(var(--nue-padding-xs) + var(--nue-gap-sm) + 1.025 * var(--nue-text-xs));
}

/* 日期为数字，等宽数字避免 `01` 与 `8` 之间宽度抖动（参考件无此行，视觉零影响） */
.due-panel__picker .nue-button__text {
    font-variant-numeric: tabular-nums;
}

/* 开关行：取提醒设置器 `.nue-div--row` 的取值（文字在左、开关在右、定高整行）；
   多出的 `cursor` / `user-select` 是「整行可点」需要（参考件该行不可点，故无此两条） */
.due-panel__switch-row {
    padding: 0 var(--nue-padding-xs);
    font-size: var(--nue-text-xs);
    flex: none;
    height: var(--nue-box-size-xs);
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
}

/* 动作区：参考件是 `flex-end` + `.nue-button{flex:1}`；本面板只有一个「清除日期」⇒ 左对齐、不拉伸 */
.due-panel__actions {
    display: flex;
    justify-content: flex-start;
    gap: var(--nue-gap-2xs);
}

.due-panel [role='switch']:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 2px;
    border-radius: var(--nue-radius-sm);
}
</style>