<template>
    <nue-div :data-simple="simple" class="todo-table">
        <nue-div class="todo-table__header" wrap="nowrap">
            <div class="todo-table__header__col col-name">
                <order-button prop="name">名称</order-button>
            </div>
            <div v-if="columnOptions.createdAt" class="todo-table__header__col col-created-at">
                <order-button prop="createdAt">创建时间</order-button>
            </div>
            <div v-if="columnOptions.updatedAt" class="todo-table__header__col col-updated-at">
                <order-button prop="updatedAt">最后修改时间</order-button>
            </div>
            <div v-if="columnOptions.endAt" class="todo-table__header__col col-end-at">
                <order-button prop="endAt">结束日期</order-button>
            </div>
            <div v-if="columnOptions.priority" class="todo-table__header__col col-priority">
                <order-button prop="priority">优先级</order-button>
            </div>
            <div v-if="columnOptions.state" class="todo-table__header__col col-state">
                <order-button prop="state">状态</order-button>
            </div>
            <div v-if="columnOptions.project" class="todo-table__header__col col-project">
                <order-button prop="project">所属清单</order-button>
            </div>
            <div class="todo-table__header__col col-actions">
                <nue-icon
                    v-if="sortOptions?.field"
                    color="gray"
                    name="clear"
                    @click="handleClearSortInfo"
                />
                <nue-icon v-else name="more" style="opacity: 0" />
            </div>
        </nue-div>
        <nue-divider class="todo-table__divider" />
        <nue-div class="todo-table__body">
            <slot name="empty">
                <nue-text
                    v-if="!todos.length"
                    align="center"
                    color="gray"
                    size="12px"
                    style="margin-top: 16px"
                >
                    没有待办事项，放松一下吧！
                </nue-text>
            </slot>
            <nue-div
                v-for="(todo, idx) in todos"
                :key="todo.id"
                :data-done="todo.state === 'done'"
                :data-selected="idx >= selectRange.start && idx <= selectRange.end"
                class="todo-table__body__row"
                @click.stop.exact="handleShowDetails(todo.id, idx)"
                @click.stop.shift.exact="handleMultiSelect(idx)"
            >
                <nue-div class="todo-table__body__col col-name" vertical>
                    <nue-button align="left" class="todo-table-main__row__name" theme="pure">
                        {{ todo.name }}
                        <template #append>
                            <todo-tag-bar
                                :clamped="2"
                                :tags="tags"
                                :todoTags="todo.tags"
                                readonly
                                small
                            />
                        </template>
                    </nue-button>
                    <nue-text
                        v-if="columnOptions.description && todo.description"
                        class="todo-table-main__row__description"
                        size="12px"
                    >
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.createdAt"
                    class="todo-table__body__col col-created-at"
                >
                    <nue-text size="12px">
                        {{ useRelativeDate(todo.createdAt) }}
                    </nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.updatedAt"
                    class="todo-table__body__col col-updated-at"
                >
                    <nue-text size="12px">
                        {{ useRelativeDate(todo.updatedAt) }}
                    </nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.endAt"
                    :key="refreshKey"
                    class="todo-table__body__col col-end-at"
                >
                    <nue-text :data-expired="isTodoExpired(todo)" size="12px">
                        {{ useRelativeDate(todo.dueDate.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columnOptions.priority" class="todo-table__body__col col-priority">
                    <todo-priority-info :key="todo.priority" :priority="todo.priority" />
                </nue-div>
                <nue-div v-if="columnOptions.state" class="todo-table__body__col col-state">
                    <todo-state-info :key="todo.state" :state="todo.state" />
                </nue-div>
                <nue-div v-if="columnOptions.project" class="todo-table__body__col col-project">
                    <nue-text :clamped="1" size="12px">
                        {{ todo.project?.title || '收集箱' }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-actions">
                    <nue-icon
                        :name="todo.isDeleted ? 'restore' : 'delete'"
                        @click.stop="handleDeleteBtnClk(todo.id, todo.isDeleted)"
                    />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, TodoTagBar } from '@nao-todo/components'
import { useTodoTable } from './use-table'
import { useRelativeDate } from '@nao-todo/hooks'
import OrderButton from './order-button.vue'
import { useRefreshKey } from './use-refresh-key'
import type { TodoTableEmits, TodoTableProps } from './types'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const {
    selectRange,
    isTodoExpired,
    handleDeleteBtnClk,
    handleShowDetails,
    handleMultiSelect,
    handleClearSelectedId,
    handleClearSelect,
    handleClearSortInfo
} = useTodoTable(props, emit)

const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()

onMounted(() => startRefresh())

onBeforeUnmount(() => stopRefresh())

defineExpose({
    reset: handleClearSelectedId,
    resetSelect: handleClearSelect
})
</script>

<style scoped>
@import url('table.css');
</style>
