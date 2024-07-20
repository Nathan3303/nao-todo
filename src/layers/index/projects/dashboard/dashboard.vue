<template>
    <div class="project-dashboard">
        <nue-div align="stretch" class="project-dashboard__projects">
            <nue-div align="center" justify="space-between">
                <nue-text theme="h3">我的项目</nue-text>
                <nue-button theme="primary,small" icon="plus" @click="handleCreateProject">
                    创建新项目
                </nue-button>
            </nue-div>
            <project-board :projects="projects" allow-route></project-board>
        </nue-div>
    </div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/use-project-store'
import { ProjectBoard } from '@/components'

defineOptions({ name: 'ProjectsDashboard' })
defineProps<{ projects: Project[] }>()

const handleCreateProject = () => {
    const createProjectBtn = document.querySelector(
        '#create-project-btn'
    ) as HTMLButtonElement | null
    createProjectBtn?.click()
}
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
