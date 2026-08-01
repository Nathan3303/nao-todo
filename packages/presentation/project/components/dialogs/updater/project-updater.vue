<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useProjectUpdater from './use-project-updater'
import {
    type DialogInstanceType,
    useDialogWrapper,
    ProjectForm,
    PROJECT_UPDATER_DIALOG_KEY,
    t
} from '@nao-todo/shared'
import { ProjectUpdaterDialogProps } from './types'

defineOptions({ name: 'ProjectUpdater' })
const props = defineProps<ProjectUpdaterDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { states, formData, getProject, updateProject, resetStates } = useProjectUpdater(props)
const { visible, close } = useDialogWrapper(dialogRef)

const open = (projectId: string) => {
    resetStates()
    const ok = getProject(projectId)
    if (ok) visible.value = true
}

const handleConfirm = async () => {
    const ok = await updateProject()
    if (ok) close()
}

onMounted(() => {
    props.dialogManager.register(PROJECT_UPDATER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog theme="project-updater" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>{{ t('dialog.projectUpdater.title') }}</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <project-form v-model="formData" :disabled="states.updating" />
        </template>
        <template #footer>
            <nue-button :disabled="states.updating" @click="close">
                {{ t('common.cancel') }}
            </nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.updating"
                theme="primary"
                @click="handleConfirm"
            >
                {{ t('common.update') }}
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--project-updater {
    min-width: min(24rem, 100vw);
}
</style>