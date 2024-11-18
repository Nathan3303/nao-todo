<template>
    <nue-dropdown theme="combo-box">
        <template #default="{ clickTrigger }">
            <nue-button theme="small" icon="menu" @click.stop="clickTrigger">列设置</nue-button>
        </template>
        <template #dropdown>
            <nue-container>
                <nue-header>
                    <nue-text size="14px">显示/隐藏列</nue-text>
                </nue-header>
                <nue-main>
                    <nue-div vertical gap="4px">
                        <empty :empty="!modelValue">
                            <checkbox
                                v-for="(value, key) in modelValue"
                                :key="key"
                                :label="parseLabel(key)"
                                :value="key"
                                :checked="value"
                                @check="handleCheck"
                            />
                        </empty>
                    </nue-div>
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { Checkbox, Empty } from '@nao-todo/components'
import type { TodoColumnOptions } from '@nao-todo/types'

defineOptions({ name: 'TodoTableColumnSelector' })
const props = defineProps<{
    modelValue: TodoColumnOptions
}>()
const emit = defineEmits<{
    (event: 'update:modelValue', value: TodoColumnOptions): void
}>()

const parseLabel = (label: string) => {
    switch (label) {
        case 'createdAt':
            return '创建时间'
        case 'updatedAt':
            return '更新时间'
        case 'priority':
            return '优先级'
        case 'state':
            return '状态'
        case 'description':
            return '描述'
        case 'endAt':
            return '结束日期'
        case 'project':
            return '所属清单'
        default:
            return label
    }
}

const handleCheck = (checked: boolean, value: unknown) => {
    const newColumns = { ...props.modelValue }
    newColumns[value as keyof TodoColumnOptions] = checked
    emit('update:modelValue', newColumns as TodoColumnOptions)
}
</script>
