<template>
    <project-kanban :project-id="projectId"></project-kanban>
</template>

<script setup lang="ts">
import { ProjectKanban } from '@nao-todo/layers/index'
defineProps<{ projectId: string }>()
</script>

<style scoped></style>
