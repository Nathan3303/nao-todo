<template>
    <nue-dialog ref="dialogRef" v-model="visible" :closable="!loading" title="创建清单">
        <nue-div align="stretch" vertical>
            <nue-div align="stretch" gap="4px" vertical>
                <nue-input
                    ref="projectNameInputRef"
                    v-model="newProjectPayload.title"
                    :debounce-time="240"
                    :disabled="loading"
                    clearable
                    placeholder="请输入清单名称"
                    title="清单名称"
                />
                <nue-text v-if="isProjectTitleEmpty" color="#f56c6c" size="12px">
                    * 清单名称不能为空
                </nue-text>
            </nue-div>
            <nue-div align="stretch" gap="8px" vertical>
                <nue-checkbox v-model="isAddDescription" :disabled="loading" size="small">
                    添加清单备注
                </nue-checkbox>
                <nue-textarea
                    v-if="isAddDescription"
                    v-model="newProjectPayload.description"
                    :rows="0"
                    autosize
                    placeholder="清单描述"
                    title="Project description"
                ></nue-textarea>
            </nue-div>
        </nue-div>
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click="handleAddProject">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<script lang="ts" setup>
import { nextTick, ref, watch } from 'vue'
import { NueInput } from 'nue-ui'
import type { CreateProjectOptions } from '@nao-todo/types'

defineOptions({ name: 'CreateProjectDialog' })
const props = defineProps<{ handler: (payload: CreateProjectOptions) => Promise<any> }>()

const defaultNewProjectPayload: CreateProjectOptions = { title: '', description: '' }

const visible = ref(false)
const loading = ref(false)
const isProjectTitleEmpty = ref(false)
const isAddDescription = ref(false)
const newProjectPayload = ref<CreateProjectOptions>({ ...defaultNewProjectPayload })
const projectNameInputRef = ref<InstanceType<typeof NueInput>>()

const showCreateProjectDialog = () => {
    visible.value = true
    nextTick(() => projectNameInputRef.value?.innerInputRef?.focus())
}

const handleClearInputValues = () => {
    isProjectTitleEmpty.value = false
    isAddDescription.value = false
    newProjectPayload.value = { ...defaultNewProjectPayload }
}

const handleAddProject = async () => {
    const { handler } = props
    if (!newProjectPayload.value.title) {
        isProjectTitleEmpty.value = true
        return
    }
    loading.value = true
    try {
        const result = await handler(newProjectPayload.value)
        if (!result) return
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
    (newVal) => newVal && (isProjectTitleEmpty.value = !newVal)
)

defineExpose({
    show: showCreateProjectDialog,
    clear: handleClearInputValues
})
</script>
