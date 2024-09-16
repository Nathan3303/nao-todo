<template>
    <nue-dialog theme="project-manager" ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div class="project-manager">
            <nue-text size="12px" color="gray">
                "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <project-filter-bar :filter-info="filterInfo" @filter="handleFilter" />
                <nue-div width="fit-content" gap="12px">
                    <nue-button
                        theme="small,primary"
                        icon="plus-circle"
                        @click="handleShowCreateProjectDialog"
                    >
                        新增
                    </nue-button>
                    <nue-button theme="small" icon="refresh" @click="refresh"> 刷新 </nue-button>
                </nue-div>
            </nue-div>
            <project-board
                :projects="projects"
                :loading-state="loading"
                @archive-project="archiveProject"
                @unarchive-project="unarchiveProject"
                @delete-project="deleteProject"
                @restore-project="restoreProject"
            />
        </nue-div>
    </nue-dialog>
    <create-project-dialog ref="createProjectDialogRef" :handler="createProject" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    getProjects,
    createProject,
    handleArchiveProject,
    handleUnarchiveProject,
    handleDeleteProject,
    handleRestoreProject
} from '@/utils/project-handlers'
import { useProjectStore } from '@/stores'
import { ProjectBoard, ProjectFilterBar, CreateProjectDialog } from '@/components/project'
import type { Project, ProjectFilterOptions } from '@/stores'

defineOptions({ name: 'ProjectManager' })

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const visible = ref(false)
const loading = ref(false)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const filterInfo = ref<ProjectFilterOptions>({})
const projects = ref<Project[]>([])

const init = () => {
    const res = projectStore._toFiltered(filterInfo.value)
    projects.value = res
}

const refresh = async () => {
    loading.value = true
    await getProjects({ page: 1, limit: 99 })
    init()
    loading.value = false
}

const handleShowDialog = () => {
    visible.value = true
    init()
}

const handleFilter = async (newFilterInfo: ProjectFilterOptions) => {
    filterInfo.value = newFilterInfo
    init()
}

const handleShowCreateProjectDialog = async () => {
    createProjectDialogRef.value?.show()
}

const archiveProject = async (projectId: Project['id']) => {
    const archiveResult = await handleArchiveProject(projectId)
    init()
    if (archiveResult && archiveResult.code !== '20000') return
    const projectIdInRoute = route.params.projectId
    if (projectIdInRoute !== projectId) return
    router.push('/tasks/all')
}

const unarchiveProject = async (projectId: Project['id']) => {
    await handleUnarchiveProject(projectId)
    init()
}

const deleteProject = async (projectId: Project['id']) => {
    const archiveResult = await handleDeleteProject(projectId)
    init()
    if (archiveResult && archiveResult.code !== '20000') return
    const projectIdInRoute = route.params.projectId
    if (projectIdInRoute !== projectId) return
    router.push('/tasks/all')
}

const restoreProject = async (projectId: Project['id']) => {
    await handleRestoreProject(projectId)
    init()
}

defineExpose({
    show: handleShowDialog
})
</script>

<style scoped>
@import url('./project-manager.css');
</style>
