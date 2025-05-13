<template>
    <nue-div :id="tableId" :class="['todo-table', { 'todo-table--mobile': isOnMobile }]">
        <nue-div v-if="!isOnMobile" class="todo-table__header" wrap="nowrap">
            <div class="todo-table__header__col col-name">
                <order-button prop="name">名称</order-button>
            </div>
            <div v-if="columnOptions.createdAt" class="todo-table__header__col col-created-at">
                <order-button prop="createdAt">创建时间</order-button>
            </div>
            <div v-if="columnOptions.updatedAt" class="todo-table__header__col col-updated-at">
                <order-button prop="updatedAt">更新时间</order-button>
            </div>
            <div v-if="columnOptions.endAt" class="todo-table__header__col col-end-at">
                <order-button prop="endAt">结束时间</order-button>
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
        <nue-divider v-if="!isOnMobile" />
        <nue-div class="todo-table__main">
            <slot v-if="!todos.length" name="empty">
                <nue-text class="todo-table__main__empty-text"> 当前列表无待办任务！ </nue-text>
            </slot>
            <nue-div
                v-for="(todo, idx) in todos"
                v-else
                :key="todo.id"
                :data-done="todo.state === 'done'"
                :data-selected="idx >= selectRange.start && idx <= selectRange.end"
                :data-deleted="useDeletedLine && todo.isDeleted"
                :data-giveup="todo.isGivenUp"
                class="todo-table__main__row"
                @click.stop.exact="handleShowDetails(todo.id, idx)"
                @click.stop.shift.exact="handleMultiSelect(idx)"
            >
                <nue-div class="todo-table__main__col col-name" vertical>
                    <nue-div align="center" wrap="nowrap">
                        <nue-div class="col-name__name" flex width="auto" gap=".5rem" align="center">
                            <span class="col-name__giveup-tag" v-if="todo.isGivenUp">已放弃</span>
                            <nue-text
                                :clamped="1"
                                color="var(--primary-text-color)"
                                size="var(--text-sm)"
                            >
                                {{ todo.name }}
                            </nue-text>
                        </nue-div>
                        <todo-tag-bar
                            :clamped="tagBarClamped"
                            :tags="tags"
                            :todoTags="todo.tags"
                            readonly
                            small
                        />
                    </nue-div>
                    <nue-div v-if="columnOptions.description && todo.description" vertical>
                        <nue-text :clamped="2" class="col-name__description" size="var(--text-xs)">
                            {{ todo.description }}
                        </nue-text>
                    </nue-div>
                </nue-div>
                <nue-div
                    v-if="columnOptions.createdAt"
                    class="todo-table__main__col col-created-at"
                >
                    <nue-text :title="useRelativeDate(todo.createdAt)" size="var(--text-xs)">
                        {{ useRelativeDate(todo.createdAt) }}
                    </nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.updatedAt"
                    class="todo-table__main__col col-updated-at"
                >
                    <nue-text :title="useRelativeDate(todo.updatedAt)" size="var(--text-xs)">
                        {{ useRelativeDate(todo.updatedAt) }}
                    </nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.endAt"
                    :key="refreshKey"
                    :data-expired="isTodoExpired(todo)"
                    class="todo-table__main__col col-end-at"
                >
                    <nue-text :title="useRelativeDate(todo.dueDate.endAt)" size="var(--text-xs)">
                        {{ useRelativeDate(todo.dueDate.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columnOptions.priority" class="todo-table__main__col col-priority">
                    <todo-priority-info
                        :key="todo.priority"
                        :priority="todo.priority"
                        use-clamped
                    />
                </nue-div>
                <nue-div v-if="columnOptions.state" class="todo-table__main__col col-state">
                    <todo-state-info :key="todo.state" :state="todo.state" use-clamped />
                </nue-div>
                <nue-div v-if="columnOptions.project" class="todo-table__main__col col-project">
                    <nue-text :clamped="1" size="12px">
                        {{
                            todo.project?.title ||
                            getProjectNameByIdFromLocal(todo.projectId) ||
                            '收集箱'
                        }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__main__col col-actions">
                    <slot :todo="todo" name="row-actions">
                        <nue-icon
                            :name="todo.isDeleted ? 'restore' : 'delete'"
                            @click.stop="handleDeleteBtnClk(todo.id, todo.isDeleted)"
                        />
                    </slot>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, TodoTagBar } from '@nao-todo/components'
import { useTodoTable } from './use-table'
import { useRelativeDate } from '@nao-todo/hooks'
import OrderButton from './order-button.vue'
import { useRefreshKey } from './use-refresh-key'
import { generateId } from '@nao-todo/utils'
import type { TodoTableEmits, TodoTableProps } from './types'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const tableId = generateId()
const isOnMobile = ref(false)
let resizeObserver: ResizeObserver | null = null

const {
    selectRange,
    tagBarClamped,
    isTodoExpired,
    handleDeleteBtnClk,
    handleShowDetails,
    handleMultiSelect,
    handleClearSelectedId,
    handleClearSelect,
    handleClearSortInfo,
    getProjectNameByIdFromLocal
} = useTodoTable(props, emit)
const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()

// 监听元素宽度
const useTableResizeObserver = () => {
    if (!window.ResizeObserver) return
    const todoTable = document.getElementById(tableId)
    if (!todoTable) return
    resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            isOnMobile.value = entry.target.clientWidth < 800
        }
    })
    resizeObserver.observe(todoTable)
}

// 取消监听元素宽度
const unUseTableResizeObserver = () => {
    if (!resizeObserver) return
    const todoTable = document.getElementById(tableId)
    if (!todoTable) return
    resizeObserver.unobserve(todoTable)
    resizeObserver = null
}

onMounted(() => {
    startRefresh()
    useTableResizeObserver()
})
onBeforeUnmount(() => {
    stopRefresh()
    unUseTableResizeObserver()
})

defineExpose({
    reset: handleClearSelectedId,
    resetSelect: handleClearSelect
})
</script>

<style scoped>
@import url('table.css');
</style>
