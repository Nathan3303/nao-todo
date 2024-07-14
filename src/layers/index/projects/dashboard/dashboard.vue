<template>
    <nue-div vertical>
        <nue-text theme="h3">最近的项目</nue-text>
        <empty
            :empty="!projects.length"
            align="left"
            message="最近没有项目，可以通过左侧项目清单头部中的 '+' 按钮创建新项目。"
        >
            <div class="project-card-container">
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                ></project-card>
            </div>
        </empty>
    </nue-div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/use-project-store'
import { ProjectCard, Empty } from '@/components'

defineOptions({ name: 'ProjectsDashboard' })
defineProps<{ projects: Project[] }>()
</script>

<style scoped>
.project-card-container {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, 300px);
    grid-template-rows: 240px;
    gap: 20px;
}
</style>
