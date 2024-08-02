<template>
    <nue-dialog v-model="visible" title="创建项目" @confirm="handleCreateProject">
        <nue-div vertical align="stretch">
            <nue-input
                ref="projectNameInputRef"
                v-model="newProjectPayload.name"
                title="Project name"
                placeholder="项目名称 (必填)"
            ></nue-input>
            <nue-textarea
                v-model="newProjectPayload.description"
                title="Project description"
                placeholder="项目描述"
                :rows="0"
                autosize
            ></nue-textarea>
        </nue-div>
        <template #footer="{ cancel, confirm }">
            <nue-button @click.stop="cancel">取消</nue-button>
            <nue-button theme="primary" @click.stop="confirm">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { CreateProjectDialogEmits, NewProjectPayload } from './types'
import { NueMessage, NueInput } from 'nue-ui'

defineOptions({ name: 'CreateProjectDialog' })
const emit = defineEmits<CreateProjectDialogEmits>()

const visible = ref(false)
const newProjectPayload = ref<NewProjectPayload>({ name: '', description: '' })
const projectNameInputRef = ref<InstanceType<typeof NueInput>>()

const showCreateProjectDialog = () => {
    visible.value = true
    nextTick(() => {
        projectNameInputRef.value?.innerInputRef?.focus()
    })
}

const handleCreateProject = () => {
    if (!newProjectPayload.value.name) {
        NueMessage.error('Project name is required')
        return
    }
    emit('create', newProjectPayload.value)
}

const handleClearInputValues = () => {
    newProjectPayload.value = { name: '', description: '' }
}

defineExpose({
    show: showCreateProjectDialog,
    clear: handleClearInputValues
})
</script>

<style scoped></style>
