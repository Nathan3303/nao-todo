<template>
    <nue-div vertical>
        <nue-div>
            <nue-div vertical theme="card" flex="1 1 auto" width="20%">
                <nue-div align="center" justify="space-between">
                    <nue-text size="16px"> Total </nue-text>
                    <nue-icon name="todo" size="18px"></nue-icon>
                </nue-div>
                <nue-text size="32px" weight="bold"> {{ todosInfo?.total || 0 }} </nue-text>
            </nue-div>
            <nue-div vertical theme="card" flex="1 1 auto" width="20%">
                <nue-div align="center" justify="space-between">
                    <nue-text size="16px"> To Do </nue-text>
                    <nue-icon name="circle" size="18px"></nue-icon>
                </nue-div>
                <nue-text size="32px" weight="bold"> {{ todosInfo?.toDo || 0 }} </nue-text>
            </nue-div>
            <nue-div vertical theme="card" flex="1 1 auto" width="20%">
                <nue-div align="center" justify="space-between">
                    <nue-text size="16px"> In Progress </nue-text>
                    <nue-icon name="in-progress" size="18px"></nue-icon>
                </nue-div>
                <nue-text size="32px" weight="bold"> {{ todosInfo?.inProgress || 0 }} </nue-text>
            </nue-div>
            <nue-div vertical theme="card" flex="1 1 auto" width="20%">
                <nue-div align="center" justify="space-between">
                    <nue-text size="16px"> Done </nue-text>
                    <nue-icon name="success-fill" size="18px"></nue-icon>
                </nue-div>
                <nue-text size="32px" weight="bold"> {{ todosInfo?.done || 0 }} </nue-text>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@/stores/use-todo-store'

const props = defineProps<{ todos?: Todo[] }>()

const todosInfo = computed(() => {
    if (!props.todos) return {}
    const { todos } = props
    let total = todos.length
    let toDo = 0
    let inProgress = 0
    let done = 0
    todos.forEach((todo) => {
        switch (todo.state) {
            case 'todo':
                toDo++
                break
            case 'in-progress':
                inProgress++
                break
            case 'done':
                done++
                break
        }
    })
    return { total, toDo, inProgress, done }
})
</script>

<style scoped></style>
