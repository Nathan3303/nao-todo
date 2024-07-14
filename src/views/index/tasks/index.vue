<template>
    <nue-main aside-width="200px">
        <!-- <template #aside>
            <nue-link theme="btnlike,actived">所有</nue-link>
            <nue-link theme="btnlike">今天</nue-link>
            <nue-link theme="btnlike">昨天</nue-link>
            <nue-link theme="btnlike">最近七天</nue-link>
        </template> -->
        <template #content>
            <nue-div vertical gap="24px" wrap="nowrap" stlye="padding: 24px">
                <nue-div justify="space-between">
                    <nue-div vertical gap="4px" width="fit-content">
                        <nue-text size="26px" weight="bold">
                            欢迎回来, {{ user?.nickName }}!
                        </nue-text>
                        <nue-text size="14px" color="gray">
                            今天是
                            <nue-text size="14px">
                                {{ moment().format('dddd, MMMM Do YYYY') }}
                            </nue-text>
                            ， 以下是今天的任务。
                        </nue-text>
                    </nue-div>
                    <nue-div width="fit-content" gap="6px" style="margin: 6px"></nue-div>
                </nue-div>
                <nue-div align="center" gap="12px">
                    <nue-input
                        theme="small"
                        placeholder="Search tasks..."
                        icon="search"
                        v-model="searchText"
                        clearable
                        disabled
                    ></nue-input>
                    <nue-button theme="small" icon="plus-circle" disabled>Project</nue-button>
                    <nue-button theme="small" icon="plus-circle" disabled>Status</nue-button>
                    <nue-button theme="small" icon="plus-circle" disabled>Priority</nue-button>
                    <nue-button theme="small,pure" disabled>
                        Reset
                        <template #append><nue-icon name="clear"></nue-icon></template>
                    </nue-button>
                </nue-div>
                <nue-div vertical flex wrap="nowrap">
                    <todo-card v-for="todo in todos" :key="todo.id" :todo="todo"></todo-card>
                </nue-div>
            </nue-div>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TodoCard, TodoStateInfo } from '@/components'
import { useTodoStore, type Todo, type TodoState } from '@/stores/use-todo-store'
import { useUserStore } from '@/stores/use-user-store'
import { useProjectStore } from '@/stores/use-project-store'
import { storeToRefs } from 'pinia'
import moment from 'moment'
import { useLoadingScreen } from '@/hooks'

const projectStore = useProjectStore()
const todoStore = useTodoStore()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)
const { todos } = storeToRefs(todoStore)
const searchText = ref('')
const collapseValue = ref(['todo', 'in-progress'])

await projectStore.getProjects()
todoStore.getAllTodos(user.value!.id)
useLoadingScreen().stopLoading()

// const categoriedTodos = computed(() => {
//     const result: Record<TodoState, { label: string; todos: Todo[] }> = {
//         todo: {
//             label: '待办',
//             todos: []
//         },
//         ['in-progress']: {
//             label: '进行中',
//             todos: []
//         },
//         done: {
//             label: '已完成',
//             todos: []
//         }
//     }
//     for (const todo of todos.value) {
//         if (todo.state === 'todo') {
//             result.todo.todos.push(todo)
//         } else if (todo.state === 'in-progress') {
//             result['in-progress'].todos.push(todo)
//         } else {
//             result.done.todos.push(todo)
//         }
//     }

//     return result
// })
</script>

<style scoped>
.nue-main {
    &:deep(.nue-main__content) {
        display: flex;
        /* align-items: center; */
        justify-content: center;
    }
}
</style>
