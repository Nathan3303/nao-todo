<template>
    <nue-dialog theme="project-manager" ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div class="project-manager">
            <nue-text size="12px" color="gray">
                "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <project-filter-bar :filter-info="getOptions" @filter="handleFilter" />
                <nue-div width="fit-content" gap="12px">
                    <nue-button theme="small,primary" icon="plus-circle"> 新增 </nue-button>
                    <!-- <nue-button theme="small" icon="refresh" @click="refresh"> 刷新 </nue-button> -->
                </nue-div>
            </nue-div>
            <project-board :projects="projects" :loading-state="loading" />
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { createProjectWithConfirmation } from '@/handlers'
import { useProjectStore } from '@/stores/use-project-store'
import { ProjectBoard, ProjectFilterBar } from '@nao-todo/components/project'
import type { CreateProjectOptions, GetProjectsOptions } from '@nao-todo/types'

defineOptions({ name: 'ProjectManager' })

const projectStore = useProjectStore()

const { projects, getOptions } = storeToRefs(projectStore)

const visible = ref(false)
const loading = ref(false)

const handleCreateProject = async (payload: CreateProjectOptions) => {
    await createProjectWithConfirmation(payload)
}

const handleFilter = (payload: GetProjectsOptions) => {
    projectStore.updateGetOptions(payload)
}

defineExpose({
    show: () => (visible.value = true)
})
</script>

<style scoped>
@import url('./project-manager.css');
</style>
