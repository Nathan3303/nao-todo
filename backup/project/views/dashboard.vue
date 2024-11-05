<template>
    <projects-dashboard :projects="projects"></projects-dashboard>
</template>

<script setup lang="ts">
import { ProjectsDashboard } from '@nao-todo/layers/index/projects'
import { useProjectStore } from '@nao-todo/stores/use-project-store'
import { storeToRefs } from 'pinia'

const projectStore = useProjectStore()

const { projects } = storeToRefs(projectStore)
</script>

<style scoped></style>
