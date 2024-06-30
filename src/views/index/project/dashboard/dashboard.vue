<template>
    <project-dashboard :projects="projects"></project-dashboard>
</template>

<script setup lang="ts">
import { ProjectDashboard } from '@/layers/index'
import { useProjectStore } from '@/stores/use-project-store'
import { storeToRefs } from 'pinia'

const projectStore = useProjectStore()

const { projects } = storeToRefs(projectStore)
</script>

<style scoped></style>
