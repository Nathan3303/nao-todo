<template>
    <!-- Project title -->
    <nue-div justify="space-between" wrap="nowrap" style="min-height: 56px">
        <nue-div vertical gap="4px" flex>
            <nue-text size="24px" weight="bold"> {{ project?.name }} </nue-text>
            <nue-text v-if="project?.description" size="14px" color="gray">
                {{ project?.description }}
            </nue-text>
            <nue-button v-else theme="pure" @click="handleAddDescription">
                Add description
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
            <nue-link theme="btnlike" :route="{ name: 'project-main-table' }">
                Table View
            </nue-link>
            <nue-link theme="btnlike" disabled> Board View </nue-link>
        </nue-div>
        <nue-div flex width="fit-content">
            <nue-button theme="pure" icon="delete" @click="handleDeleteProject">
                Delete
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/useProjectStore'
import { NuePrompt, NueConfirm, NueMessage } from 'nue-ui'

defineProps<{ project: Project }>()
const emit = defineEmits<{
    (event: 'deleteProject'): void
    (event: 'addDescription', description: Project['description']): void
}>()

function handleDeleteProject() {
    NueConfirm({
        title: 'Delete project',
        content: 'Are you sure to delete this project?'
    }).then(
        () => emit('deleteProject'),
        () => NueMessage.info('Operation canceled')
    )
}

function handleAddDescription() {
    NuePrompt({
        title: 'Add description',
        placeholder: 'Please input description here...',
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then(
        (description) => emit('addDescription', description as string),
        () => NueMessage.info('Operation canceled')
    )
}
</script>
