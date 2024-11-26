<template>
    <nue-dialog theme="project-manager" ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div class="project-manager">
            <nue-text size="12px" color="gray">
                "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <project-filter-bar :filter-options="getOptions" @filter="handleFilter" />
                <nue-div width="fit-content" gap="12px">
                    <nue-button
                        theme="small,primary"
                        icon="plus-circle"
                        @click="showCreateProjectDialog"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-div>
            <project-board
                :projects="projects"
                :loading-state="loading"
                @delete-project="projectStore.removeProjectWithConfirmation"
                @restore-project="projectStore.restoreProjectWithConfirmation"
                @delete-project-permanently="projectStore.removeProjectPermanently"
                @archive-project="projectStore.archiveProjectWithConfirmation"
                @unarchive-project="projectStore.unarchiveProjectWithConfirmation"
            />
        </nue-div>
    </nue-dialog>
    <create-project-dialog ref="createProjectDialogRef" :handler="projectStore.doCreateProject" />
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useProjectStore } from '@/stores/use-project-store'
import { CreateProjectDialog } from '@/layers'
import { ProjectBoard, ProjectFilterBar } from '@nao-todo/components/project'
import type { Project, GetProjectsOptions, GetProjectsOptionsRaw } from '@nao-todo/types'

defineOptions({ name: 'ProjectManager' })

const projectStore = useProjectStore()

const visible = ref(false)
const loading = ref(false)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const getOptions = shallowRef<GetProjectsOptionsRaw>({})

const projects = computed<Project[]>(() => {
    return projectStore.findProjectsFromLocal(getOptions.value, (key, project, options) => {
        if (key === 'title' && options[key]) {
            return project[key].includes(options[key] as string)
        }
    })
})

const showCreateProjectDialog = () => createProjectDialogRef.value?.show()
const handleFilter = async (payload: GetProjectsOptions | null) =>
    (getOptions.value = payload || {})

defineExpose({ show: () => (visible.value = true) })
</script>

<style scoped>
@import url('./project-manager.css');
</style>
