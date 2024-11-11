<template>
    <nue-div class="project-manager">
        <nue-text size="12px" color="gray">
            "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
        </nue-text>
        <nue-div align="center" justify="space-between">
            <project-filter-bar :filter-info="filterInfo" @filter="handleFilter" />
            <nue-div width="fit-content" gap="12px">
                <nue-button theme="small,primary" icon="plus-circle"> 新增 </nue-button>
                <!-- <nue-button theme="small" icon="refresh" @click="refresh"> 刷新 </nue-button> -->
            </nue-div>
        </nue-div>
        <project-board :projects="projects" :loading-state="loading" />
    </nue-div>
</template>

<script setup lang="ts">
import { useProjectManager } from './use-project-manager'
import { ProjectBoard } from '@nao-todo/components/project'

defineOptions({ name: 'ProjectManager' })

const { loading, projects } = useProjectManager()
</script>

<style scoped>
@import url('./project-manager.css');
</style>
