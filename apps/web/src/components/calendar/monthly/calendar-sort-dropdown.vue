<script setup lang="ts">
import {
    DropdownDivBlock,
    InnerDropdown,
    InnerDropdownOption,
    type InnerDropdownOptionVO
} from '@nao-todo/shared'
import { computed } from 'vue'
import {
    CALENDAR_SORT_DEFAULT_ORDER,
    type CalendarSort,
    type CalendarSortField
} from './calendar-sort'

defineOptions({ name: 'CalendarSortDropdown' })

const props = defineProps<{ modelValue: CalendarSort }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: CalendarSort): void }>()

/** 未选字段哨兵（「默认（按名称）」选项） */
const SORT_FIELD_NONE = 'none'

/** 字段选项：顶部「默认（按名称）」= 未选字段；四项字段（样式参考任务视图 sort-operator 两级结构） */
const FIELD_OPTIONS: ReadonlyArray<{
    label: string
    value: CalendarSortField | typeof SORT_FIELD_NONE
}> = [
    { label: '默认（按名称）', value: SORT_FIELD_NONE },
    { label: '优先级', value: 'priority' },
    { label: '开始时间', value: 'startAt' },
    { label: '截止时间', value: 'endAt' },
    { label: '创建时间', value: 'createdAt' }
]

/** 未选字段时升降序锁定（默认名称排序恒为升序） */
const isSorting = computed(() => props.modelValue.field !== undefined)

const fieldOptions = computed<InnerDropdownOptionVO[]>(() =>
    FIELD_OPTIONS.map((option) => ({
        icon: '',
        label: option.label,
        value: option.value,
        checked:
            option.value === SORT_FIELD_NONE
                ? props.modelValue.field === undefined
                : props.modelValue.field === option.value
    }))
)

const orderOptions = computed<InnerDropdownOptionVO[]>(() => [
    {
        icon: 'arrow-up',
        label: '升序',
        value: 'asc',
        checked: props.modelValue.order === 'asc'
    },
    {
        icon: 'arrow-down',
        label: '降序',
        value: 'desc',
        checked: props.modelValue.order === 'desc'
    }
])

/** 选择字段：默认（none）→ 未选字段升序；字段 → 保留当前方向（缺省升序） */
const onField = (value: string): void => {
    emit('update:modelValue', {
        field: value === SORT_FIELD_NONE ? undefined : (value as CalendarSortField),
        order:
            value === SORT_FIELD_NONE
                ? 'asc'
                : props.modelValue.order || CALENDAR_SORT_DEFAULT_ORDER
    })
}

/** 选择升降序（仅在已选字段时可用） */
const onOrder = (value: string): void => {
    emit('update:modelValue', {
        field: props.modelValue.field,
        order: value === 'desc' ? 'desc' : 'asc'
    })
}
</script>

<template>
    <nue-dropdown placement="bottom-end" size="small" theme="menu" group="calendar-sort">
        <template #trigger="{ trigger }">
            <nue-button icon="filter" theme="icon,ghost" title="日历排序" @click.stop="trigger" />
        </template>
        <dropdown-div-block title="排序">
            <inner-dropdown title="排序字段" icon="select" @execute="onField">
                <dropdown-div-block title="选择排序字段">
                    <inner-dropdown-option
                        v-for="option in fieldOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </dropdown-div-block>
            </inner-dropdown>
            <inner-dropdown title="升降序" icon="select" :disabled="!isSorting" @execute="onOrder">
                <dropdown-div-block title="选择升降序">
                    <inner-dropdown-option
                        v-for="option in orderOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </dropdown-div-block>
            </inner-dropdown>
        </dropdown-div-block>
    </nue-dropdown>
</template>

<style scoped></style>