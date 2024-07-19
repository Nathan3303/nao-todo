<template>
    <nue-div class="todo-table" :data-simple="simple">
        <!-- 表格头部 -->
        <nue-div class="todo-table__header" wrap="nowrap">
            <div class="todo-table__header__col col-name">
                <nue-text>名称</nue-text>
            </div>
            <div class="todo-table__header__col col-created-at" v-if="columns.createdAt">
                <nue-text>创建时间</nue-text>
            </div>
            <div class="todo-table__header__col col-updated-at" v-if="columns.updatedAt">
                <nue-text>最后修改时间</nue-text>
            </div>
            <div class="todo-table__header__col col-priority" v-if="columns.priority">
                <nue-text>优先级</nue-text>
            </div>
            <div class="todo-table__header__col col-state" v-if="columns.state">
                <nue-text>状态</nue-text>
            </div>
            <div class="todo-table__header__col col-actions">
                <nue-icon name="more" style="opacity: 0"></nue-icon>
            </div>
        </nue-div>
        <!-- 分隔符 -->
        <nue-divider class="todo-table__divider"></nue-divider>
        <!-- 表格内容 -->
        <nue-div class="todo-table__body">
            <empty
                :empty="!todos.length"
                text-size="12px"
                full-height
                message="当前列表无数据。"
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
                <nue-div class="todo-table__body__col col-priority" v-if="columns.priority">
                    <todo-priority-info
                        :priority="todo.priority"
                        :key="todo.priority"
                    ></todo-priority-info>
                </nue-div>
                <nue-div class="todo-table__body__col col-state" v-if="columns.state">
                    <todo-state-info :state="todo.state" :key="todo.state"></todo-state-info>
                </nue-div>
                <nue-div class="todo-table__body__col col-actions">
                    <nue-icon
                        name="delete"
                        color="red"
                        @click.stop="handleDelete(todo.id)"
                    ></nue-icon>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import type { TodoTableEmits, TodoTableProps } from './types'
import { TodoPriorityInfo, TodoStateInfo, Empty } from '@/components'
import { useTodoTable } from './use-todo-table'
import moment from 'moment'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const { selectedId, handleDelete, handleShowDetails, handleClearSelectedId } = useTodoTable(
    props,
    emit
)

defineExpose({
    reset: handleClearSelectedId
})
</script>

<style scoped>
@import url('./todo-table.css');
</style>
