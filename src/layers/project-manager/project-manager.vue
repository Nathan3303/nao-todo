<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">
                "清单管理"能够清楚地展示出所有的清单，方便执行清单的增删改查。
            </nue-text>
            <nue-div class="project-navigations">
                <nue-link theme="btnlike,actived">看板</nue-link>
                <nue-link theme="btnlike">列表</nue-link>
            </nue-div>
            <nue-input
                v-model="filterInfo.title"
                placeholder="搜索清单"
                icon="search"
                :debounce-time="500"
            />
            <nue-div class="project-manager" vertical align="stretch">
                <project-board
                    :projects="projects"
                    :loading-state="loading"
                    @archive-project="archiveProject"
                    @unarchive-project="unarchiveProject"
                    @delete-project="deleteProject"
                    @restore-project="restoreProject"
                />
            </nue-div>
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    toGettedProjects,
    handleArchiveProject,
    handleUnarchiveProject,
    handleDeleteProject,
    handleRestoreProject
} from '@/utils/project-handlers'
import { ProjectBoard } from '@/components/project'
import { NueMessage, NueInput, NueConfirm } from 'nue-ui'
import type { CreateProjectDialogEmits, CreateProjectDialogProps } from './types'
import type { ProjectFilterOptions, Project } from '@/stores'

defineOptions({ name: 'ProjectManager' })
// const props = defineProps<CreateProjectDialogProps>()
// const emit = defineEmits<CreateProjectDialogEmits>()

const route = useRoute()
const router = useRouter()

const visible = ref(false)
const loading = ref(true)
const projects = ref<Project[]>([])
const filterInfo = reactive<ProjectFilterOptions>({
    title: '',
    page: 1,
    limit: 20
})

const init = async () => {
    loading.value = true
    projects.value = await toGettedProjects({ ...filterInfo })
    loading.value = false
}

const archiveProject = async (projectId: Project['id']) => {
    const archiveResult = await handleArchiveProject(projectId)
    if (archiveResult.code !== '20000') return
    const projectIdInRoute = route.params.projectId
    if (projectIdInRoute !== projectId) return
    router.push('/tasks/all')
}

const unarchiveProject = async (projectId: Project['id']) => {
    console.log(projectId);
    const unarchiveResult = await handleUnarchiveProject(projectId)
    console.log(unarchiveResult)
}

const deleteProject = async () => {}

const restoreProject = async () => {}

watch(
    () => filterInfo,
    async () => await init(),
    { deep: true, immediate: true }
)

defineExpose({
    show: () => (visible.value = true)
})
</script>

<style scoped>
@import url('./project-manager.css');
</style>
