<template>
    <project-overview :todos="todos"></project-overview>
</template>

<script setup lang="ts">
import { useTodoStore } from '@/stores/use-todo-store'
import { ProjectOverview } from '@/layers/index'
import { storeToRefs } from 'pinia'

const todoStore = useTodoStore()
const { todos } = storeToRefs(todoStore)
</script>

<style scoped></style>
