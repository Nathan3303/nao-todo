<template>
    <nue-main aside-width="200px">
        <!-- <template #aside>
            <nue-link theme="btnlike,actived">Today</nue-link>
            <nue-link theme="btnlike">Yesterday</nue-link>
            <nue-link theme="btnlike">This week</nue-link>
            <nue-link theme="btnlike">This month</nue-link>
        </template> -->
        <template #content>
            <nue-div vertical gap="24px" wrap="nowrap" stlye="padding: 24px">
                <nue-div justify="space-between">
                    <nue-div vertical gap="4px" width="fit-content">
                        <nue-text size="26px" weight="bold">
                            Welcome back, {{ user?.nickName }}!
                        </nue-text>
                        <nue-text size="14px" color="gray">
                            Today is
                            <nue-text size="14px">
                                {{ moment().format('dddd, MMMM Do YYYY') }}
                            </nue-text>
                            . Here are your tasks for today.
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
                <nue-div vertical height="100%" flex wrap="nowrap">
                    <nue-collapse v-model="collapseValue">
                        <nue-collapse-item v-for="(value, key) in todos" :key="key" :name="key">
                            <template #header="{ collapse }">
                                <nue-button @click="collapse()">
                                    <todo-state-info :state="key"></todo-state-info>
                                    <template #append>
                                        <nue-icon
                                            class="outter-toggle-button"
                                            name="arrow-up"
                                            size="12px"
                                        ></nue-icon>
                                    </template>
                                </nue-button>
                            </template>
                            <nue-div
                                theme="card"
                                align="center"
                                v-for="todo in value"
                                style="padding: 8px 16px"
                                wrap="nowrap"
                                :divider="{}"
                            >
                                <!-- <nue-icon name="circle" size="16px" color="green"></nue-icon> -->
                                <nue-div vertical flex>
                                    <nue-text size="14px">{{ todo.name }}</nue-text>
                                    <nue-text v-if="todo.description" size="12px" color="gray">
                                        {{ todo.description }}
                                    </nue-text>
                                </nue-div>
                                <nue-button
                                    theme="pure"
                                    style="width: 90px; justify-content: center"
                                >
                                    <todo-priority-info
                                        :priority="todo.priority"
                                    ></todo-priority-info>
                                </nue-button>
                            </nue-div>
                        </nue-collapse-item>
                    </nue-collapse>
                </nue-div>
            </nue-div>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TodoStateInfo, TodoPriorityInfo } from '@/components'
import { useTodoStore, type Todo } from '@/stores/use-todo-store'
import { useUserStore } from '@/stores/use-user-token'
import { storeToRefs } from 'pinia'
import moment from 'moment'

const todoStore = useTodoStore()
const userStore = useUserStore()

const { user } = storeToRefs(userStore)
const searchText = ref('')
const collapseValue = ref(['todo', 'in-progress'])

const todos = computed(() => {
    let result: { [key in Todo['state']]?: Todo[] } = {}
    todoStore.todos.forEach((todo) => {
        if (todo.state in result) {
            result[todo.state]!.push(todo)
        } else {
            result[todo.state] = [todo]
        }
    })
    return result
})

console.log(todos.value)
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
