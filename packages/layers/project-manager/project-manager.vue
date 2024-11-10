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
            <project-board :projects="projects" :loading-state="loading" />
        </nue-div>
    </nue-dialog>
    <create-project-dialog ref="createProjectDialogRef" :handler="createProject" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectBoard, ProjectFilterBar, CreateProjectDialog } from '@nao-todo/components/project'
import { useProjectManagerStore } from './store'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'ProjectManager' })

const projectManagerStore = useProjectManagerStore()

const visible = ref(false)
const loading = ref(false)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const { projects } = storeToRefs(projectManagerStore)

const handleShowDialog = () => {
    visible.value = true
    projectManagerStore.init()
}

const handleShowCreateProjectDialog = async () => {
    createProjectDialogRef.value?.show()
}

defineExpose({
    show: handleShowDialog
})
</script>

<style scoped>
@import url('./project-manager.css');
</style>
