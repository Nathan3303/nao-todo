<template>
    <project-overview :todos="currentTodos"></project-overview>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import { useTodoStore, type Todo } from '@/stores/useTodoStore'
import { ProjectOverview } from '@/layers/index'
import type { ProjectViewContext } from './types'

const projectViewContext = inject<ProjectViewContext>('projectViewContext')!
const todoStore = useTodoStore()

const currentTodos = computed<Todo[]>(() => {
    const result: Todo[] = []
    const { id: pid } = projectViewContext.currentProject.value
    if (pid) {
        todoStore.read().filter((todo) => {
            if (todo.projectId === pid) {
                result.push(todo)
            }
            return false
        })
    }
    return result
})
</script>

<style scoped></style>
