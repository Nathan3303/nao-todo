<template>
    <div class="project-dashboard">
        <suspense>
            <my-projects class="project-dashboard__projects"></my-projects>
        </suspense>
    </div>
</template>

<script setup lang="ts">
import MyProjects from './my-projects.vue'
import type { Project } from '@nao-todo/stores/use-project-store'

defineOptions({ name: 'ProjectsDashboard' })
defineProps<{ projects: Project[] }>()
</script>

<style scoped>
.project-dashboard {
    display: grid;
    grid-template-columns: 3fr 2fr;
    grid-template-rows: auto 64px 1fr;

    .project-dashboard__projects {
        flex-direction: column;
        flex-wrap: nowrap;
        grid-column: 1 / 3;
    }
}
</style>
