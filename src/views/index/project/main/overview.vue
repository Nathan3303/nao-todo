<template>
    <project-overview :count-info="countInfo" :project="project"></project-overview>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useTodoStore } from '@/stores/use-todo-store'
import { ProjectOverview } from '@/layers/index'
import { storeToRefs } from 'pinia'
import type { ProjectViewContext } from './types'

const todoStore = useTodoStore()

const { currentProject: project } = inject('projectViewContext') as ProjectViewContext
const { countInfo } = storeToRefs(todoStore)
</script>

<style scoped></style>
