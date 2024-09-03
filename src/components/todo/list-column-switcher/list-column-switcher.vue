<template>
    <nue-dropdown theme="combo-box">
        <template #default="{ clickTrigger }">
            <nue-button theme="small" icon="menu" @click.stop="clickTrigger"> 列设置 </nue-button>
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
                                :label="parseLabel(key)"
                                :value="key"
                                :checked="value"
                                @check="handleCheck"
                            ></checkbox>
                        </empty>
                    </nue-div>
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { Checkbox, Empty } from '@/components'
import type { Columns, ColumnsKeys } from '../table/types'
import type { ListColumnSwitcherEmits, ListColumnSwitcherProps } from './types'

defineOptions({ name: 'ListColumnSwitcher' })
const props = defineProps<ListColumnSwitcherProps>()
const emit = defineEmits<ListColumnSwitcherEmits>()

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
    const { modelValue } = props
    const newColumns = { ...modelValue }
    newColumns[value as ColumnsKeys] = checked
    emit('update:modelValue', newColumns as Columns)
}
</script>

<!-- <style scoped>
.toggle-columns-dropdown {
    &:deep(.nue-dropdown) {
        padding: 0px;
    }
    .nue-container {
        width: 192px;
        padding: 0px;

        .nue-header {
            height: 43px;
            padding: 12px;
        }

        .nue-main {
            flex-direction: column;
            padding: 4px;
        }
    }
}
</style> -->
