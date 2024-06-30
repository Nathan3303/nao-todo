<template>
    <!-- Project title -->
    <nue-div justify="space-between" wrap="nowrap" style="min-height: 56px">
        <nue-div vertical gap="4px" flex>
            <nue-button theme="pure" title="Click to edit project name" @click="handleEditName">
                <nue-text size="28px" weight="bold"> {{ project?.name }} </nue-text>
            </nue-button>
            <nue-button
                theme="pure"
                title="Click to edit project description"
                @click="handleEditDescription"
            >
                <nue-text size="14px" color="gray">
                    {{ project?.description || 'Click to add description' }}
                </nue-text>
            </nue-button>
        </nue-div>
        <nue-div align="center" justify="end" flex gap="8px">
            <nue-text size="12px">Create by</nue-text>
            <nue-avatar
                src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
            ></nue-avatar>
        </nue-div>
    </nue-div>

    <!-- Project navigation -->
    <nue-div style="margin-top: 16px" justify="space-between" wrap="nowrap" align="center">
        <nue-div flex>
            <nue-link theme="btnlike" :route="{ name: 'project-main-overview' }">
                Overview
            </nue-link>
            <nue-link theme="btnlike" :route="{ name: 'project-main-table' }"> Tasks </nue-link>
        </nue-div>
        <nue-div flex width="fit-content" wrap="nowrap">
            <nue-button theme="pure" icon="warning" @click="infoDialogVisible = true">
                Details
            </nue-button>
            <nue-button theme="pure" icon="delete" @click="handleDeleteProject" style="color: red">
                Delete
            </nue-button>
        </nue-div>
    </nue-div>

    <!-- Project info dialog -->
    <nue-dialog v-model="infoDialogVisible" title="Project information">
        <nue-div vertical>
            <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> Id </nue-text>
                <nue-text size="14px"> {{ project?.id }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> Name </nue-text>
                <nue-text size="14px"> {{ project?.name }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="4px">
                <nue-text size="12px" color="gray"> Description </nue-text>
                <nue-text size="14px"> {{ project?.description || 'No description' }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="6px" flex>
                <nue-text size="12px" color="gray"> Created by </nue-text>
                <nue-div align="center" gap="6px">
                    <nue-avatar
                        src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                    ></nue-avatar>
                    <nue-text size="12px">Nathan</nue-text>
                </nue-div>
            </nue-div>
            <nue-div wrap="nowrap">
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Created at </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.created_at).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Updated at </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.updated_at).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Project } from '@/stores/useProjectStore'
import { NuePrompt, NueConfirm, NueMessage } from 'nue-ui'
import moment from 'moment'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{
    (event: 'deleteProject'): void
    (event: 'editName', name: Project['name']): void
    (event: 'editDescription', description: Project['description']): void
}>()

const infoDialogVisible = ref(false)

function handleDeleteProject() {
    NueConfirm({
        title: 'Delete project',
        content: 'Are you sure to delete this project?'
    }).then(
        () => emit('deleteProject'),
        () => NueMessage.info('Operation canceled')
    )
}

function handleEditName() {
    NuePrompt({
        title: 'Edit project name',
        placeholder: 'Please input name here...',
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        inputValue: props.project.name,
        validator: (value: any) => value
    }).then(
        (name) => emit('editName', name as string),
        () => NueMessage.info('Operation canceled')
    )
}

function handleEditDescription() {
    NuePrompt({
        title: 'Edit project description',
        placeholder: 'Please input description here...',
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        inputType: 'textarea',
        inputValue: props.project.description,
        validator: (value: any) => value
    }).then(
        (description) => emit('editDescription', description as string),
        () => NueMessage.info('Operation canceled')
    )
}
</script>
