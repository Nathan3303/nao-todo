<template>
    <!-- <nue-div theme="card" wrap="nowrap" flex align="stretch"> -->
        <projects-main-list :project-id="project.id"></projects-main-list>
    <!-- </nue-div> -->
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { ProjectsMainList } from '@nao-todo/layers/index/projects'
import type { ProjectViewContext } from './types'

const { currentProject: project } = inject('projectViewContext') as ProjectViewContext
</script>
