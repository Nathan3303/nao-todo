<template>
    <nue-dropdown class="toggle-columns-dropdown" align="right">
        <template #default="{ clickTrigger }">
            <nue-button theme="small" icon="menu" @click.stop="clickTrigger"> View </nue-button>
        </template>
        <template #dropdown>
            <nue-container>
                <nue-header>
                    <nue-text size="14px">Toggle columns</nue-text>
                </nue-header>
                <nue-main>
                    <empty :empty="!modelValue">
                        <checkbox
                            v-for="(value, key) in modelValue"
                            :label="key"
                            :value="key"
                            :checked="value"
                            @check="handleCheck"
                        ></checkbox>
                    </empty>
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import type { Columns, ColumnsKeys } from '../todo-table/types'
import { type ListColumnSwitcherEmits, type ListColumnSwitcherProps } from './types'
import { Checkbox, Empty } from '@/components'

defineOptions({ name: 'ListColumnSwitcher' })
const props = defineProps<ListColumnSwitcherProps>()
const emit = defineEmits<ListColumnSwitcherEmits>()

const handleCheck = (checked: boolean, value: unknown) => {
    const { modelValue } = props
    const newColumns = { ...modelValue }
    newColumns[value as ColumnsKeys] = checked
    // console.log(newColumns)
    emit('update:modelValue', newColumns as Columns)
}
</script>

<style scoped>
.toggle-columns-dropdown {
    &:deep().nue-dropdown {
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
</style>
