<template>
    <nue-div class="todo-table" :data-simple="simple">
        <nue-div class="todo-table__header" wrap="nowrap">
            <div class="todo-table__header__col col-name">
                <order-button prop="name">名称</order-button>
            </div>
            <div class="todo-table__header__col col-created-at" v-if="columns.createdAt">
                <order-button prop="createdAt">创建时间</order-button>
            </div>
            <div class="todo-table__header__col col-updated-at" v-if="columns.updatedAt">
                <order-button prop="updatedAt">最后修改时间</order-button>
            </div>
            <div class="todo-table__header__col col-end-at" v-if="columns.endAt">
                <order-button prop="endAt">结束日期</order-button>
            </div>
            <div class="todo-table__header__col col-priority" v-if="columns.priority">
                <order-button prop="priority">优先级</order-button>
            </div>
            <div class="todo-table__header__col col-state" v-if="columns.state">
                <order-button prop="state">状态</order-button>
            </div>
            <div class="todo-table__header__col col-project" v-if="columns.project">
                <order-button prop="project">所属清单</order-button>
            </div>
            <div class="todo-table__header__col col-actions">
                <nue-icon
                    v-if="sortInfo.field"
                    name="clear"
                    color="gray"
                    @click="handleClearSortInfo"
                />
                <nue-icon v-else name="more" style="opacity: 0" />
            </div>
        </nue-div>
        <nue-divider class="todo-table__divider" />
        <nue-div class="todo-table__body">
            <slot name="empty">
                <nue-empty
                    v-if="!todos.length"
                    image-src="/images/relaxation.png"
                    image-size="64px"
                    description="没有待办事项，放松一下吧！"
                    style="height: 100%; flex: auto"
                />
            </slot>
            <nue-div
                class="todo-table__body__row"
                v-for="(todo, idx) in todos"
                :key="todo.id"
                :data-selected="idx >= selectRange.start && idx <= selectRange.end"
                :data-done="todo.isDone || todo.state === 'done'"
                @click.stop.exact="handleShowDetails(todo.id, idx)"
                @click.stop.shift.exact="handleMultiSelect(idx)"
            >
                <nue-div class="todo-table__body__col col-name" vertical>
                    <nue-button class="todo-table-main__row__name" theme="pure" align="left">
                        {{ todo.name }}
                        <template #append>
                            <todo-tag-bar
                                :tags="tags"
                                :todoTags="todo.tags"
                                :clamped="2"
                                readonly
                                small
                            />
                        </template>
                    </nue-button>
                    <nue-text
                        v-if="columns.description && todo.description"
                        class="todo-table-main__row__description"
                        size="12px"
                    >
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-created-at" v-if="columns.createdAt">
                    <nue-text size="12px">
                        {{ useRelativeDate(todo.createdAt) }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-updated-at" v-if="columns.updatedAt">
                    <nue-text size="12px">
                        {{ useRelativeDate(todo.updatedAt) }}
                    </nue-text>
                </nue-div>
                <nue-div
                    class="todo-table__body__col col-end-at"
                    v-if="columns.endAt"
                    :key="refreshKey"
                >
                    <nue-text size="12px" :data-expired="isTodoExpired(todo)">
                        {{ useRelativeDate(todo.dueDate.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-priority" v-if="columns.priority">
                    <todo-priority-info :priority="todo.priority" :key="todo.priority" />
                </nue-div>
                <nue-div class="todo-table__body__col col-state" v-if="columns.state">
                    <todo-state-info :state="todo.state" :key="todo.state" />
                </nue-div>
                <nue-div class="todo-table__body__col col-project" v-if="columns.project">
                    <nue-text size="12px" :clamped="1">
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

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, TodoTagBar } from '@/components'
import { useTodoTable } from './use-table'
import { useRelativeDate } from '@/hooks/use-relative-date'
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
@import url('./table.css');
</style>
