<template>
    <nue-dropdown theme="combo-box,small" hide-on-click>
        <template #default="{ clickTrigger }">
            <nue-div align="center" gap="4px">
                <nue-text size="12px" color="gray" @click="clickTrigger" style="cursor: pointer">
                    <slot>{{ text }}</slot>
                </nue-text>
                <nue-icon
                    v-if="checkNumber"
                    :name="checkNumber === 1 ? 'arrow-up' : 'arrow-down'"
                    size="11px"
                    color="gray"
                />
            </nue-div>
        </template>
        <template #dropdown>
            <nue-container>
                <nue-main style="flex-direction: column">
                    <nue-div
                        align="center"
                        class="nue-dropdown-item"
                        @click="handleUpdateSortInfo(1)"
                    >
                        <nue-icon size="12px" name="arrow-up" />
                        <nue-text size="12px" style="flex: auto">升序</nue-text>
                        <nue-icon v-if="checkNumber === 1" size="12px" name="check" />
                    </nue-div>
                    <nue-div
                        align="center"
                        class="nue-dropdown-item"
                        @click="handleUpdateSortInfo(-1)"
                    >
                        <nue-icon size="12px" name="arrow-down" />
                        <nue-text size="12px" style="flex: auto">降序</nue-text>
                        <nue-icon v-if="checkNumber === -1" size="12px" name="check" />
                    </nue-div>
                    <!-- <nue-divider style="margin: 4px 0px" />
                    <nue-div align="center" class="nue-dropdown-item">
                        <nue-icon size="14px" name="eye-close" />
                        <nue-text size="13px">隐藏</nue-text>
                    </nue-div> -->
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import { ref } from 'vue'
import type { TodoTableContext } from './types'
import type { Todo, TodoSortOptions } from '@/stores'

defineOptions({ name: 'TodoTableOrderButton' })
const props = defineProps<{ prop: TodoSortOptions['field']; text?: string }>()

const todoTableContext = inject<TodoTableContext>('TodoTableContext')

const checkNumber = computed(() => {
    const { prop } = props
    if (!todoTableContext) return
    const { sortInfo } = todoTableContext
    if (prop !== sortInfo.field) return
    return sortInfo.order === 'asc' ? 1 : -1
})

const handleUpdateSortInfo = (flag: 1 | -1) => {
    if (!todoTableContext) return
    const { sortInfo } = todoTableContext
    const { prop } = props
    const order = flag === 1 ? 'asc' : 'desc'
    if (sortInfo.field === prop && sortInfo.order === order) return
    sortInfo.field = prop
    sortInfo.order = order
}
</script>

<style scoped></style>
