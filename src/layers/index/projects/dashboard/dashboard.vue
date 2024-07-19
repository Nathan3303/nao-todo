<template>
    <div class="project-dashboard">
        <nue-div class="project-dashboard__projects">
            <nue-div align="center" justify="space-between">
                <nue-text theme="h3">我的项目</nue-text>
                <nue-button theme="primary,small" icon="plus" @click="handleCreateProject">
                    创建新项目
                </nue-button>
            </nue-div>
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
    </div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/use-project-store'
import { ProjectCard, Empty } from '@/components'

defineOptions({ name: 'ProjectsDashboard' })
defineProps<{ projects: Project[] }>()

const handleCreateProject = () => {
    const createProjectBtn = document.querySelector(
        '#create-project-btn'
    ) as HTMLButtonElement | null
    // console.log(createProjectBtn)
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
        gap: 12px;

        .project-card-container {
            width: 100%;
            height: 240px;
            display: flex;
            gap: 12px;
            padding-bottom: 6px;
            overflow-x: auto;

            .project-card {
                max-width: 220px;
            }
        }
    }
}
</style>
