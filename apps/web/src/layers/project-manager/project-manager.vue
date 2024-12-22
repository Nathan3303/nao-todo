<template>
    <nue-dialog ref="dialogRef" v-model="visible" theme="project-manager" title="清单管理">
        <nue-div class="project-manager">
            <nue-text color="gray" size="12px">
                "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <project-filter-bar :filter-options="getOptions" @filter="handleFilter" />
                <nue-div gap="12px" width="fit-content">
                    <nue-button
                        icon="plus-circle"
                        theme="small,primary"
                        @click="tasksDialogStore.showCreateProjectDialog"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-div>
            <project-board
                :loading-state="loading"
                :projects="projects"
                @delete-project="handleDeleteProject"
                @restore-project="projectStore.restoreProjectWithConfirmation"
                @delete-project-permanently="handleDeleteProjectPermanently"
                @archive-project="handleArchiveProject"
                @unarchive-project="projectStore.unarchiveProjectWithConfirmation"
            />
        </nue-div>
    </nue-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/use-project-store'
import { useTasksDialogStore } from '@/views/index/tasks'
import { ProjectBoard, ProjectFilterBar } from '@nao-todo/components/project'
import type { GetProjectsOptions, GetProjectsOptionsRaw, Project } from '@nao-todo/types'

defineOptions({ name: 'ProjectManager' })

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const tasksDialogStore = useTasksDialogStore()

const visible = ref(false)
const loading = ref(false)
const getOptions = shallowRef<GetProjectsOptionsRaw>({})

const projects = computed<Project[]>(() => {
    return projectStore.findProjectsFromLocal(getOptions.value, (key, project, options) => {
        if (key === 'title' && options[key]) {
            return project[key].includes(options[key] as string)
        }
    })
})

const handleFilter = async (payload: GetProjectsOptions | null) =>
    (getOptions.value = payload || {})

const switchRouteIfRemoved = async (comparedProjectId: Project['id']) => {
    const projectIdOnRoute = route.params.projectId as string
    if (projectIdOnRoute !== comparedProjectId) return
    await router.replace({
        name: 'tasks-all'
    })
}

const handleDeleteProject = async (projectId: Project['id']) => {
    const result = await projectStore.removeProjectWithConfirmation(projectId)
    if (result) await switchRouteIfRemoved(projectId)
}

const handleDeleteProjectPermanently = async (projectId: Project['id']) => {
    const result = await projectStore.removeProjectPermanently(projectId)
    if (result) await switchRouteIfRemoved(projectId)
}

const handleArchiveProject = async (projectId: Project['id']) => {
    const result = await projectStore.archiveProjectWithConfirmation(projectId)
    if (result) await switchRouteIfRemoved(projectId)
}

defineExpose({ show: () => (visible.value = true) })
</script>

<style scoped>
@import url('./project-manager.css');
</style>
