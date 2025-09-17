<template>
    <nue-div vertical height="100%" wrap="nowrap">
        <nue-div align="stretch" gap="4px" vertical>
            <nue-input
                ref="tagNameInputRef"
                v-model="newTag.name"
                :disabled="creating"
                placeholder="请输入标签名称"
                title="标签名称"
                maxlength="36"
                counter="word-left"
            />
            <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px">* 标签名称不能为空</nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-textarea
                v-model="newTag.description"
                :disabled="creating"
                :rows="4"
                placeholder="标签描述"
                title="Project description"
                maxlength="128"
                counter="word-left"
                :autosize="{ minRows: 1, maxRows: 3 }"
                theme="fix-padding"
            />
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
            <tag-color-selector v-model="newTag.color" />
        </nue-div>
        <nue-div align="center" justify="end">
            <nue-button @click="emit('closeDialog')">取消</nue-button>
            <nue-button :loading="creating" theme="primary" @click="handleConfirm">
                创建
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { NueDiv, NueInput, NueTextarea } from 'nue-ui'
import { TagColorSelector } from '@nao-todo/components'
import useTagCreator, { type TagCreatorEmits } from './use-tag-creator'

defineOptions({ name: 'TagCreator' })

const emit = defineEmits<TagCreatorEmits>()

const { creating, isNameEmpty, newTag, handleConfirm } = useTagCreator(emit)

const tagNameInputRef = ref<InstanceType<typeof NueInput>>()

onMounted(() => {
    tagNameInputRef.value?.innerInputRef?.focus()
})
</script>
