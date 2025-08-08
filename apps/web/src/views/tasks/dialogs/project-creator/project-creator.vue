<template>
    <nue-div align="stretch" vertical height="100%">
        <nue-div align="stretch" gap="4px" vertical>
            <nue-input
                ref="projectNameInputRef"
                v-model="newProject.title"
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
                v-model="newProject.description"
                :disabled="!isAddDescription || loading"
                :rows="4"
                placeholder="清单描述"
                title="Project description"
            />
        </nue-div>
        <nue-div align="center" justify="end" style="margin-top: auto">
            <nue-button @click.stop="emit('closeDialog')">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click="handleConfirm">
                创建
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { NueInput } from 'nue-ui'
import type { CreateProjectOptions } from '@nao-todo/types'

defineOptions({ name: 'ProjectCreator' })
const props = defineProps<{ handler: (createOptions: CreateProjectOptions) => Promise<boolean> }>()
const emit = defineEmits<{ (e: 'closeDialog'): void }>()

const defaultNewProjectPayload: CreateProjectOptions = {
    title: '',
    description: ''
}

const loading = ref(false)
const isProjectTitleEmpty = ref(false)
const isAddDescription = ref(false)
const newProject = ref<CreateProjectOptions>({ ...defaultNewProjectPayload })
const projectNameInputRef = ref<InstanceType<typeof NueInput>>()

const handleClearInputValues = () => {
    isProjectTitleEmpty.value = false
    isAddDescription.value = false
    newProject.value = { ...defaultNewProjectPayload }
}

const handleConfirm = async () => {
    if (!newProject.value.title) {
        isProjectTitleEmpty.value = true
        return
    }
    try {
        loading.value = true
        const result = await props.handler(newProject.value)
        if (!result) return
        emit('closeDialog')
        handleClearInputValues()
    } catch (e) {
        console.warn('[CreateProjectDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

watch(
    () => newProject.value.title,
    (newVal) => newVal && (isProjectTitleEmpty.value = !newVal)
)

onMounted(() => {
    projectNameInputRef.value?.innerInputRef?.focus()
})
</script>
