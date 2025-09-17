<template>
    <nue-div align="stretch" vertical height="100%">
        <nue-div align="stretch" gap="4px" vertical>
            <nue-input
                ref="nameInputRef"
                v-model="newProject.name"
                :disabled="creating"
                clearable
                placeholder="请输入清单名称"
                title="清单名称"
                maxlength="36"
                counter="word-left"
            />
            <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px">* 清单名称不能为空</nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-textarea
                v-model="newProject.description"
                :disabled="creating"
                :rows="4"
                placeholder="清单描述"
                title="Project description"
                maxlength="128"
                counter="word-left"
                :autosize="{ minRows: 1, maxRows: 3 }"
                theme="fix-padding"
            />
        </nue-div>
        <nue-div align="center" justify="end">
            <nue-button @click.stop="emit('closeDialog')">取消</nue-button>
            <nue-button :loading="creating" theme="primary" @click="handleConfirm">
                创建
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { NueDiv, type NueInput, NueTextarea } from 'nue-ui'
import useProjectCreator, { type ProjectCreatorEmits } from './use-project-creator'

defineOptions({ name: 'ProjectCreator' })

const emit = defineEmits<ProjectCreatorEmits>()

const { creating, isNameEmpty, newProject, handleConfirm } = useProjectCreator(emit)

const nameInputRef = ref<InstanceType<typeof NueInput>>()

onMounted(() => {
    nameInputRef.value?.innerInputRef?.focus()
})
</script>
