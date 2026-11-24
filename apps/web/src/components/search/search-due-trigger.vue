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
    <nue-dropdown
        placement="bottom-start"
        theme="menu"
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
        <nue-div vertical class="due-panel" gap="var(--nue-gap-sm)">
            <!-- 日期组：起 / 止各一段竖排（标签在上、控件全宽）⇒ 两者左右缘天然对齐，单边时不跳位 -->
            <nue-div vertical class="due-panel__group" gap="var(--nue-gap-sm)">
                <nue-div vertical class="due-panel__row" gap="var(--nue-gap-2xs)">
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
                <nue-div vertical class="due-panel__row" gap="var(--nue-gap-2xs)">
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
            </nue-div>
            <nue-divider />
            <!-- 无截止日开关（与「包含已归档」同风格：NueSwitch + 可见文字标签，整行可点）
                 ⛔ 开关自身的 click 带 `.stop`（nue-ui 内部）⇒ 点开关只走 switch 的分支，
                 不会与整行的 click 各抛一次而互相抵消（三方点击各产生**一次**切换）。 -->
            <nue-div
                align="center"
                class="due-panel__row due-panel__row--switch"
                gap="var(--nue-gap-2xs)"
                @click="emit('update:includeNoDue', !includeNoDue)"
            >
                <nue-switch
                    :model-value="includeNoDue"
                    size="small"
                    :aria-label="t('search.includeNoDue')"
                    @update:model-value="(value: boolean) => emit('update:includeNoDue', value)"
                />
                <span class="due-panel__switch-label">
                    {{ t('search.includeNoDue') }}
                </span>
            </nue-div>
            <!-- 清除动作独立成组（分隔线 + 左对齐），⛔ 不与开关行挤在同一组；无值时整组（含分隔线）不出现 -->
            <nue-divider v-if="active" />
            <nue-div v-if="active" vertical class="due-panel__actions" gap="var(--nue-gap-xs)">
                <nue-button
                    theme="small,ghost"
                    icon="clear"
                    class="due-panel__clear"
                    @click="emit('clear')"
                >
                    {{ t('search.filter.dueClear') }}
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped src="./filter-trigger.css"></style>

<style scoped>
/* 竖排表单（Issue #403）：骨架对齐任务详情面板的日期选择器
   —— 标签在上、控件全宽、分隔线分段；⛔ 不复用该组件（值域/提醒区/提交语义均不同）。 */
.due-panel {
    padding: var(--nue-padding-sm);
    /* 竖排不需要横排那份宽度：14rem 起、16rem 封顶（内容宽 ≈200px 时控件仍不溢出、不横滚） */
    min-width: 14rem;
    max-width: 16rem;
}

/* 标签在上：小字 + 次要色（用 600 而非参考件的 400 —— 400 在浅底约 2.8:1，达不到文本 4.5:1 下限） */
.due-panel__label {
    color: var(--nue-primary-color-600);
    line-height: 1.2;
}

.due-panel__row {
    width: 100%;
    min-width: 0;
}

/* 控件占满面板宽度：nue-ui 1.15.x 的 `__trigger` 是 `width: fit-content` 包裹层，
   只给选择器 100% 会被它收缩成内容宽 ⇒ 必须把包裹层与内层按钮一并拉满。 */
.due-panel__picker {
    width: 100%;
    min-width: 0;
}

.due-panel__picker :deep(.nue-date-picker__trigger) {
    width: 100%;
}

.due-panel__picker :deep(.nue-button) {
    width: 100%;
    box-sizing: border-box;
}

/* 日期为数字，等宽数字避免 `01` 与 `8` 之间宽度抖动 */
.due-panel__picker :deep(.nue-button__text) {
    font-variant-numeric: tabular-nums;
}

.due-panel__row--switch {
    cursor: pointer;
}

.due-panel__actions {
    width: 100%;
    padding-top: var(--nue-gap-xs);
}

.due-panel__clear {
    align-self: flex-start;
}

.due-panel__switch-label {
    cursor: pointer;
    user-select: none;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm);
}

.due-panel [role='switch']:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 2px;
    border-radius: var(--nue-radius-sm);
}
</style>