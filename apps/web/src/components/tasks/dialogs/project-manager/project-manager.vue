<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useProjectManagerStore } from '@/stores/tasks'
import ProjectManagerFilterBar from './filter-bar.vue'
import { useTasksDialogStore } from '@/stores/tasks'
import { ProjectBoard } from '@nao-todo/components/project'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import { onMounted, ref } from 'vue'

defineOptions({ name: 'ProjectManager' })
const emit = defineEmits<{ (e: 'register', open: () => void, close: () => void): void }>()

const projectManagerStore = useProjectManagerStore()
const tasksDialogStore = useTasksDialogStore()

const dialogRef = ref<DialogInstanceType>()

const { projects } = storeToRefs(projectManagerStore)
const { visible, open: openDialog, close } = useDialogWrapper(dialogRef)

const open = () => {
    projectManagerStore.loadProjects()
    openDialog()
}

onMounted(() => {
    emit('register', open, close)
})

defineExpose({ open, close })
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="large">
        <template #header>
            <nue-text>清单管理</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <nue-container id="ProjectManager" theme="in-dialog">
            <nue-header>
                <project-manager-filter-bar />
                <nue-div gap="12px" width="fit-content" style="margin-left: auto">
                    <nue-button
                        icon="plus-circle"
                        theme="small,primary"
                        @click="tasksDialogStore.projectCreator?.open"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <project-board
                        :projects="projects"
                        @delete-project="projectManagerStore.deleteProject"
                        @restore-project="projectManagerStore.restoreProject"
                        @delete-project-permanently="projectManagerStore.hardDeleteProject"
                    />
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

