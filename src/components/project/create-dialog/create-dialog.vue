<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="创建项目">
        <nue-div vertical align="stretch">
            <nue-div vertical align="stretch" gap="4px">
                <nue-input
                    ref="projectNameInputRef"
                    v-model="newProjectPayload.title"
                    title="项目名称"
                    placeholder="请输入项目名称"
                    :debounce-time="240"
                    :disabled="loading"
                    clearable
                />
                <nue-text v-if="isProjectTitleEmpty" size="12px" color="#f56c6c">
                    * 项目名称不能为空
                </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="8px">
                <nue-checkbox v-model="isAddDescription" size="small" :disabled="loading">
                    添加项目备注
                </nue-checkbox>
                <nue-textarea
                    v-if="isAddDescription"
                    v-model="newProjectPayload.description"
                    title="Project description"
                    placeholder="项目描述"
                    :rows="0"
                    autosize
                ></nue-textarea>
            </nue-div>
        </nue-div>
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button theme="primary" :loading="loading" @click="handleAddProject">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import type { CreateProjectDialogEmits, CreateProjectDialogProps } from './types'
import { NueInput } from 'nue-ui'
import type { ProjectCreateOptions } from '@/stores'

defineOptions({ name: 'CreateProjectDialog' })
const props = defineProps<CreateProjectDialogProps>()
const emit = defineEmits<CreateProjectDialogEmits>()

const visible = ref(false)
const loading = ref(false)
const isProjectTitleEmpty = ref(false)
const isAddDescription = ref(false)
const newProjectPayload = ref<ProjectCreateOptions>({ title: '', description: '' })
const projectNameInputRef = ref<InstanceType<typeof NueInput>>()

const showCreateProjectDialog = () => {
    visible.value = true
    nextTick(() => projectNameInputRef.value?.innerInputRef?.focus())
}

const handleClearInputValues = () => {
    isProjectTitleEmpty.value = false
    newProjectPayload.value = { title: '', description: '' }
}

const handleAddProject = async () => {
    const { handler } = props
    if (!newProjectPayload.value.title) {
        isProjectTitleEmpty.value = true
        return
    }
    loading.value = true
    try {
        const response = await handler(newProjectPayload.value)
        if (!response && response.code !== '20000') return
        visible.value = false
        handleClearInputValues()
    } catch (e) {
        console.warn('[CreateProjectDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

watch(
    () => newProjectPayload.value.title,
    (newVal) => (isProjectTitleEmpty.value = !newVal)
)

defineExpose({
    show: showCreateProjectDialog,
    clear: handleClearInputValues
})
</script>
