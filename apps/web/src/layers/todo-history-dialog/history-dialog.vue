<template>
    <nue-dialog v-model="visible" theme="todo-history" title="查看并顺延已过期的待办">
        <nue-div align="stretch" class="todo-history-dialog-container" vertical>
            <nue-div>
                <nue-text color="var(--primary-color-600)" size="var(--text-xs)">
                    下方罗列出所有您的待办任务中，已过期的待办。您可以通过顺延按钮，将过期任务顺延至今天，
                </nue-text>
            </nue-div>
            <nue-div align="start" gap="16px" justify="space-between">
                <nue-input
                    v-model="filterInputValue"
                    :debounce-time="256"
                    clearable
                    icon="search"
                    placeholder="搜索过期待办"
                    theme="small"
                />
                <nue-div flex="none" gap="12px" justify="end" width="fit-content">
                    <nue-button
                        v-if="todos.length"
                        icon="time"
                        theme="primary,small"
                        @click="setAllTodosEndAtToToday"
                    >
                        顺延所有
                    </nue-button>
                    <todo-table-column-selector v-model="columnOptions" />
                    <nue-tooltip content="重新请求数据" placement="bottom-center" size="small">
                        <nue-button
                            :loading="tableLoading"
                            icon="refresh"
                            theme="small"
                            @click="getExpiredTodosWithLoading"
                        />
                    </nue-tooltip>
                </nue-div>
            </nue-div>
            <nue-div class="todo-history-dialog__table">
                <Loading v-if="tableLoading" placeholder="正在加载任务列表..." />
                <todo-table
                    v-else
                    :column-options="columnOptions"
                    :sort-options="{ field: '', order: 'asc' }"
                    :tags="tags"
                    :todos="todos"
                >
                    <template #row-actions="{ todo }">
                        <nue-tooltip content="顺延至今天" placement="right-center" size="small">
                            <nue-icon name="time" @click="setTodoEndAtToToday(todo)" />
                        </nue-tooltip>
                    </template>
                    <template #empty>
                        <nue-text class="todo-table__main__empty-text">
                            {{
                                filterInputValue
                                    ? '未找到相关已过期任务'
                                    : '目前没有过期任务，去完成剩下的任务吧！'
                            }}
                        </nue-text>
                    </template>
                </todo-table>
            </nue-div>
        </nue-div>
    </nue-dialog>
</template>

<style src="./history-dialog.css"></style>

<script lang="ts" setup>
import { TodoTable, TodoTableColumnSelector } from '@/layers'
import { useHistoryDialog } from './use-history-dialog'
import { Loading } from '@nao-todo/components'

defineOptions({ name: 'TodoHistoryDialog' })

const {
    visible,
    tableLoading,
    todos,
    tags,
    filterInputValue,
    columnOptions,
    getExpiredTodosWithLoading,
    setTodoEndAtToToday,
    setAllTodosEndAtToToday
} = useHistoryDialog()

defineExpose({
    show: () => {
        visible.value = true
        getExpiredTodosWithLoading()
    }
})
</script>
