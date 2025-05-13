<template>
    <nue-div vertical height="100%" wrap="nowrap">
        <nue-div align="stretch" gap="4px" vertical>
            <nue-input
                ref="tagNameInputRef"
                v-model="newTag.name"
                :disabled="loading"
                placeholder="请输入标签名称"
                title="标签名称"
            />
            <nue-text v-if="isTagNameEmpty" color="#f56c6c" size="12px">
                * 标签名称不能为空
            </nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
            <tag-color-selector v-model="newTag.color" />
        </nue-div>
        <nue-div align="center" justify="end" style="margin-top: auto">
            <nue-button @click="emit('closeDialog')">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click="handleCreateTag">
                创建
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { NueInput } from 'nue-ui'
import { TagColorSelector } from '@nao-todo/components'
import type { CreateTagOptions } from '@nao-todo/types'

defineOptions({ name: 'TagCreator' })
const props = defineProps<{ handler: (options: CreateTagOptions) => Promise<boolean> }>()
const emit = defineEmits<{ (e: 'closeDialog'): void }>()

const defaultTagTemplate = {
    name: '',
    color: 'transparent',
    description: ''
}

const tagNameInputRef = ref<InstanceType<typeof NueInput>>()
const newTag = ref<CreateTagOptions>({ ...defaultTagTemplate })
const loading = ref(false)
const isTagNameEmpty = ref(false)

const handleClearInputValues = () => {
    newTag.value = { ...defaultTagTemplate }
}

const handleCreateTag = async () => {
    if (!newTag.value.name) {
        isTagNameEmpty.value = true
        return
    }
    try {
        loading.value = true
        const response = await props.handler({ ...newTag.value })
        if (!response) return
        emit('closeDialog')
        handleClearInputValues()
    } catch (e) {
        console.warn('[CreateTagDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

watch(
    () => newTag.value.name,
    (newVal) => newVal && (isTagNameEmpty.value = !newVal)
)

onMounted(() => {
    tagNameInputRef.value?.innerInputRef?.focus()
})
</script>
