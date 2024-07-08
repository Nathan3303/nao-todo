<template>
    <!-- Project title -->
    <nue-div justify="space-between" wrap="nowrap" style="min-height: 56px">
        <nue-div vertical gap="4px" flex>
            <click-to-edit
                :text="project?.name"
                @edit="handleEditName"
                size="28px"
                weight="bold"
            ></click-to-edit>
            <click-to-edit
                :text="project?.description"
                emptyholder="Click to add description"
                @edit="handleEditDescription"
                size="14px"
                color="gray"
            ></click-to-edit>
        </nue-div>
        <nue-div align="center" justify="end" width="fit-content" gap="8px">
            <nue-button theme="icon-only" icon="warning" @click="showProjectDetailsDialog">
            </nue-button>
            <nue-button
                theme="icon-only"
                icon="delete"
                @click="handleDeleteProject"
                style="color: red"
            >
            </nue-button>
            <nue-div align="center" gap="8px" width="fit-content" style="margin-left: 4px">
                <nue-text size="12px">Create by</nue-text>
                <nue-avatar
                    src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                ></nue-avatar>
            </nue-div>
        </nue-div>
    </nue-div>

    <!-- Project navigation -->
    <nue-div style="margin-top: 6px" justify="space-between" wrap="nowrap" align="center">
        <nue-div flex>
            <nue-link theme="btnlike" :route="{ name: 'project-main-overview' }">
                Overview
            </nue-link>
            <nue-link theme="btnlike" :route="{ name: 'project-main-table' }"> Tasks </nue-link>
        </nue-div>
    </nue-div>

    <!-- Project info dialog -->
    <project-details-dialog
        ref="projectDetailsDialogRef"
        :project="project"
    ></project-details-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { ProjectsMainHeaderEmits, ProjectsMainHeaderProps } from './types'
import { ClickToEdit } from '@/components/general'
import { ProjectDetailsDialog } from '@/components/project'
import { useProjectStore } from '@/stores'

const props = defineProps<ProjectsMainHeaderProps>()
const emit = defineEmits<ProjectsMainHeaderEmits>()
const projectStore = useProjectStore()

const projectDetailsDialogRef = ref<InstanceType<typeof ProjectDetailsDialog>>()

const showProjectDetailsDialog = () => {
    projectDetailsDialogRef.value?.show()
}

const handleDeleteProject = () => {
    NueConfirm({
        title: 'Delete project',
        content: 'Are you sure to delete this project?'
    }).then(
        async () => {
            const { id } = props.project
            await projectStore.deleteProject(id)
        },
        () => NueMessage.info('Operation canceled')
    )
}

const handleEditDescription = async (newValue: string) => {
    const { id } = props.project
    await projectStore.updateProject(id, { description: newValue })
}

const handleEditName = async (newValue: string) => {
    const { id } = props.project
    await projectStore.updateProject(id, { name: newValue })
}
</script>
