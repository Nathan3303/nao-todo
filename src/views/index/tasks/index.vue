<template>
    <nue-main aside-width="200px">
        <template #aside>
            <nue-link theme="btnlike,actived">Today</nue-link>
            <nue-link theme="btnlike">Yesterday</nue-link>
            <nue-link theme="btnlike">This week</nue-link>
            <nue-link theme="btnlike">This month</nue-link>
        </template>
        <template #content>
            <nue-div vertical gap="24px" wrap="nowrap">
                <nue-div justify="space-between">
                    <nue-div vertical gap="4px" width="fit-content">
                        <nue-text size="24px" weight="bold"> Welcome back, Nathan! </nue-text>
                        <nue-text size="14px" color="gray">
                            Here are your tasks for today :
                        </nue-text>
                    </nue-div>
                    <nue-div width="fit-content" gap="6px" style="margin: 6px">
                        <nue-icon name="calendar" size="24px"></nue-icon>
                        <nue-text>{{ new Date().toLocaleDateString() }}</nue-text>
                    </nue-div>
                </nue-div>
                <nue-div vertical align="stretch">
                    <nue-input
                        theme="rounded"
                        placeholder="Search tasks..."
                        icon="search"
                    ></nue-input>
                </nue-div>
                <nue-div vertical height="100%" flex wrap="nowrap" style="overflow-y: auto">
                    <nue-div
                        theme="card"
                        align="center"
                        v-for="todo in todoStore.todos"
                        style="padding: 8px 16px"
                        wrap="nowrap"
                        :divider="{}"
                    >
                        <nue-icon name="circle" size="16px" color="green"></nue-icon>
                        <nue-div vertical flex>
                            <nue-text size="14px">{{ todo.name }}</nue-text>
                            <nue-text v-if="todo.description" size="12px" color="gray">{{
                                todo.description
                            }}</nue-text>
                        </nue-div>
                        <nue-button theme="pure" style="width: 90px; justify-content: center">
                            {{ todo.priority }}
                        </nue-button>
                    </nue-div>
                </nue-div>
            </nue-div>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { useTodoStore } from '@/stores/use-todo-store'

const todoStore = useTodoStore()

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
