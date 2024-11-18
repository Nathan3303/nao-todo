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
                </nue-main>
            </nue-container>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { TodoTableContext } from './types'
import type { GetTodosSortOptions } from '@nao-todo/types'

defineOptions({ name: 'TodoTableOrderButton' })
const props = defineProps<{ prop: GetTodosSortOptions['field']; text?: string }>()

const todoTableContext = inject<TodoTableContext>('TodoTableContext')

const checkNumber = computed(() => {
    const { prop } = props
    if (!todoTableContext) return
    const { sortOptions } = todoTableContext
    if (prop !== sortOptions.field) return
    return sortOptions.order === 'asc' ? 1 : -1
})

const handleUpdateSortInfo = (flag: 1 | -1) => {
    if (!todoTableContext) return
    const { sortOptions } = todoTableContext
    const { prop } = props
    const order = flag === 1 ? 'asc' : 'desc'
    if (sortOptions.field === prop && sortOptions.order === order) return
    sortOptions.field = prop
    sortOptions.order = order
}
</script>

<style scoped></style>
