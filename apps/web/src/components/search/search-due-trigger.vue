<script lang="ts" setup>
import { computed } from 'vue'
import { t, getLocale } from '@nao-todo/shared/locales'
import { isDueRangeActive } from './search-sort'
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

/** 日期键 → 本地化短文案（`3/1`；仅用于触发器摘要，不参与筛选计算） */
const shortLabel = (key: string): string => {
    const [year, month, day] = key.split('-').map(Number)
    const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
    return new Intl.DateTimeFormat(String(getLocale().value || 'zh-CN'), {
        month: 'numeric',
        day: 'numeric'
    }).format(date)
}

/** 区间摘要（双端 / 单边 / 未设置三态） */
const rangeText = computed(() => {
    const { from, to } = props
    if (from !== '' && to !== '')
        return t('search.filter.dueRange', { from: shortLabel(from), to: shortLabel(to) })
    if (from !== '') return t('search.filter.dueFromOnly', { from: shortLabel(from) })
    if (to !== '') return t('search.filter.dueToOnly', { to: shortLabel(to) })
    return ''
})

const selectedItem = computed(() =>
    rangeText.value === '' ? [] : [{ id: 'due', name: rangeText.value }]
)
const active = computed(() => isDueRangeActive({ from: props.from, to: props.to }))

/** 日期选择器输出（`YYYY-MM-DD` / null）→ 状态值（空 = 该侧不限） */
const onFrom = (value: string | null | undefined) => emit('update:from', value ?? '')
const onTo = (value: string | null | undefined) => emit('update:to', value ?? '')
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
                <filter-trigger-label :label="t('search.filter.due')" :items="selectedItem" />
            </nue-button>
        </template>
        <nue-div vertical class="due-panel" gap="var(--nue-gap-sm)">
            <nue-div align="center" class="due-panel__row" gap="var(--nue-gap-xs)">
                <nue-text size="var(--nue-text-sm)" class="due-panel__label">
                    {{ t('search.filter.dueFrom') }}
                </nue-text>
                <nue-date-picker
                    :model-value="from"
                    type="date"
                    size="small"
                    clearable
                    :placeholder="t('search.filter.dueFrom')"
                    data-role="due-from"
                    @update:model-value="onFrom"
                />
            </nue-div>
            <nue-div align="center" class="due-panel__row" gap="var(--nue-gap-xs)">
                <nue-text size="var(--nue-text-sm)" class="due-panel__label">
                    {{ t('search.filter.dueTo') }}
                </nue-text>
                <nue-date-picker
                    :model-value="to"
                    type="date"
                    size="small"
                    clearable
                    :placeholder="t('search.filter.dueTo')"
                    data-role="due-to"
                    @update:model-value="onTo"
                />
            </nue-div>
            <!-- 无截止日开关（与「包含已归档」同风格：NueSwitch + 可见文字标签） -->
            <nue-div align="center" class="due-panel__row" gap="var(--nue-gap-2xs)">
                <nue-switch
                    :model-value="includeNoDue"
                    size="small"
                    :aria-label="t('search.includeNoDue')"
                    @update:model-value="(value: boolean) => emit('update:includeNoDue', value)"
                />
                <span
                    class="due-panel__switch-label"
                    @click="emit('update:includeNoDue', !includeNoDue)"
                >
                    {{ t('search.includeNoDue') }}
                </span>
            </nue-div>
            <nue-button v-if="active" theme="small,ghost" icon="clear" @click="emit('clear')">
                {{ t('search.filter.dueClear') }}
            </nue-button>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped src="./filter-trigger.css"></style>

<style scoped>
.due-panel {
    padding: var(--nue-padding-sm);
    min-width: 220px;
}

.due-panel__label {
    flex: none;
}

.due-panel__row {
    width: 100%;
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