<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useProjectUpdater from './use-project-updater'
import { type DialogInstanceType, useDialogWrapper, ProjectForm } from '@nao-todo/components'
import type { ProjectUpdaterEmits, ProjectUpdaterProps } from './types'

defineOptions({ name: 'ProjectUpdater' })
const props = defineProps<ProjectUpdaterProps>()
const emit = defineEmits<ProjectUpdaterEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, formData, getProject, updateProject } = useProjectUpdater(props)
const { visible, close } = useDialogWrapper(dialogRef)

const open = (projectId: string) => {
    const ok = getProject(projectId)
    if (ok) visible.value = true
}

const handleConfirm = async () => {
    const ok = await updateProject()
    if (ok) close()
}

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog theme="project-updater" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>修改清单</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <project-form v-model="formData" :disabled="states.updating" />
        </template>
        <template #footer>
            <nue-button :disabled="states.updating" @click="close">取消</nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.updating"
                theme="primary"
                @click="handleConfirm"
            >
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--project-updater {
    min-width: min(24rem, 100vw);
}
</style>

