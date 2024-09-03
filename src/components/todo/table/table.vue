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
        <nue-divider class="todo-table__divider"></nue-divider>
        <nue-div class="todo-table__body">
            <empty
                :empty="!todos.length"
                text-size="12px"
                full-height
                :message="emptyMessage"
            ></empty>
            <nue-div
                class="todo-table__body__row"
                v-for="todo in todos"
                :key="todo.id"
                :data-selected="todo.id === selectedId"
                @click.stop="handleShowDetails(todo.id)"
            >
                <nue-div class="todo-table__body__col col-name" vertical>
                    <nue-button
                        class="todo-table-main__row__name"
                        theme="pure"
                        @click.stop="handleShowDetails(todo.id)"
                        align="left"
                    >
                        {{ todo.name }}
                    </nue-button>
                    <nue-text
                        v-if="columns.description && todo.description"
                        class="todo-table-main__row__description"
                        size="12px"
                        color="gray"
                    >
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-created-at" v-if="columns.createdAt">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-updated-at" v-if="columns.updatedAt">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-end-at" v-if="columns.endAt">
                    <nue-text size="12px" color="gray">
                        {{
                            todo.dueDate.endAt
                                ? moment(todo.dueDate.endAt).format('YYYY-MM-DD HH:mm:ss')
                                : '无日期'
                        }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-priority" v-if="columns.priority">
                    <todo-priority-info
                        :priority="todo.priority"
                        :key="todo.priority"
                    ></todo-priority-info>
                </nue-div>
                <nue-div class="todo-table__body__col col-state" v-if="columns.state">
                    <todo-state-info :state="todo.state" :key="todo.state"></todo-state-info>
                </nue-div>
                <nue-div class="todo-table__body__col col-project" v-if="columns.project">
                    <nue-text size="12px" color="gray">
                        {{ todo.project?.title || '收集箱' }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__body__col col-actions">
                    <nue-icon
                        :name="todo.isDeleted ? 'restore' : 'delete'"
                        @click.stop="handleDeleteBtnClk(todo.id, todo.isDeleted)"
                    ></nue-icon>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive, provide, watch } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, Empty } from '@/components'
import { useTodoTable } from './use-table'
import OrderButton from './order-button.vue'
import moment from 'moment'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'

defineOptions({ name: 'TodoTable' })
const props = withDefaults(defineProps<TodoTableProps>(), {
    emptyMessage: '当前列表无数据。'
})
const emit = defineEmits<TodoTableEmits>()

const sortInfo = reactive(props.sortInfo)

const { selectedId, handleDeleteBtnClk, handleShowDetails, handleClearSelectedId } = useTodoTable(
    props,
    emit
)

const handleClearSortInfo = () => {
    sortInfo.field = ''
    sortInfo.order = ''
}

provide<TodoTableContext>('TodoTableContext', {
    showDetailsHandler: handleShowDetails,
    sortInfo: sortInfo
})

watch(
    () => sortInfo,
    (newValue) => emit('sortTodo', { ...newValue }),
    { deep: true }
)

defineExpose({
    reset: handleClearSelectedId
})
</script>

<style scoped>
@import url('./table.css');
</style>
