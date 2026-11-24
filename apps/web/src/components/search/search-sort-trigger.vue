<script lang="ts" setup>
import { computed } from 'vue'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import { t } from '@nao-todo/shared/locales'
import type { LocaleKey } from '@nao-todo/shared'
import {
    isCustomSort,
    isSearchSortField,
    SEARCH_SORT_FIELDS,
    type SearchSort,
    type SearchSortField
} from './search-sort'
import FilterTriggerLabel from './filter-trigger-label.vue'

/**
 * 搜索排序触发器（T770）
 * @description 触发器风格与筛选栏既有四维触发器一致（NueButton + FilterTriggerLabel）；
 *              面板内先选字段（相关性/更新时间/截止日/优先级/名称），再选方向（升/降，
 *              相关性无方向故不呈现方向项）。状态由引擎持有，本组件 props 驱动、仅上抛。
 */

defineOptions({ name: 'SearchSortTrigger' })

const props = defineProps<{
    sort: SearchSort
}>()

const emit = defineEmits<{
    (e: 'selectField', field: SearchSortField): void
    (e: 'selectOrder', order: SearchSort['order']): void
}>()

/** 字段文案键（单一来源：五字段一档） */
const FIELD_LABEL_KEYS: Record<SearchSortField, LocaleKey> = {
    relevance: 'search.sort.relevance',
    updatedAt: 'search.sort.updatedAt',
    dueAt: 'search.sort.dueAt',
    priority: 'search.sort.priority',
    name: 'search.sort.name'
}

const fieldOptions = computed(() =>
    SEARCH_SORT_FIELDS.map((field) => ({ value: field, label: t(FIELD_LABEL_KEYS[field]) }))
)

/** 触发器展示项：当前字段（单值，沿用既有 FilterTriggerLabel 折叠规则） */
const selectedItem = computed(() => [
    { id: props.sort.field, name: t(FIELD_LABEL_KEYS[props.sort.field]) }
])

/** 方向文案（相关性无方向 → 空串，触发器不呈现） */
const orderLabel = computed(() =>
    props.sort.field === 'relevance'
        ? ''
        : t(props.sort.order === 'asc' ? 'search.sort.orderAsc' : 'search.sort.orderDesc')
)

const orderOptions = computed(() => [
    { value: 'asc' as const, label: t('search.sort.orderAsc') },
    { value: 'desc' as const, label: t('search.sort.orderDesc') }
])

const isCustom = computed(() => isCustomSort(props.sort))

/** 方向项 execute-id 前缀（与字段项同在一个面板，靠前缀分流） */
const ORDER_PREFIX = '__order__'

/** 面板点击分流：方向项 → selectOrder；字段项 → selectField（非法 id 忽略） */
const onExecute = (id: string) => {
    if (id.startsWith(ORDER_PREFIX)) {
        const order = id.slice(ORDER_PREFIX.length)
        if (order === 'asc' || order === 'desc') emit('selectOrder', order)
        return
    }
    if (isSearchSortField(id)) emit('selectField', id)
}
</script>

<template>
    <nue-dropdown
        placement="bottom-start"
        theme="menu"
        size="small"
        group="search-filter"
        :close-when-executed="false"
        @execute="onExecute"
    >
        <template #trigger="{ trigger, visible }">
            <nue-button
                :aria-expanded="visible"
                class="filter-trigger"
                :class="{ 'filter-trigger--active': isCustom }"
                theme="small"
                data-role="sort-trigger"
                @click="trigger($event)"
            >
                <filter-trigger-label :label="t('search.sort.label')" :items="selectedItem" />
                <span v-if="orderLabel" class="sort-trigger__order">{{ orderLabel }}</span>
            </nue-button>
        </template>
        <nue-div theme="block">
            <inner-dropdown-option
                v-for="option in fieldOptions"
                :key="option.value"
                :title="option.label"
                :execute-id="option.value"
                :checked="option.value === sort.field"
            />
            <!-- 方向（相关性无方向：不呈现，避免「无意义的升降」） -->
            <template v-if="sort.field !== 'relevance'">
                <nue-divider class="sort-trigger__divider" />
                <inner-dropdown-option
                    v-for="option in orderOptions"
                    :key="option.value"
                    :title="option.label"
                    :execute-id="`${ORDER_PREFIX}${option.value}`"
                    :checked="sort.order === option.value"
                />
            </template>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped src="./filter-trigger.css"></style>

<style scoped>
.sort-trigger__order {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-sm);
    white-space: nowrap;
}

.sort-trigger__divider {
    margin: var(--nue-gap-2xs) 0;
}
</style>