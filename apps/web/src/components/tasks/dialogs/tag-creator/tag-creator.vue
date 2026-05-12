<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { TagColorSelector, TagForm } from '@nao-todo/components'
import useTagCreator from './use-tag-creator'
import type { TagCreatorProps, TagCreatorEmits } from './types'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'

defineOptions({ name: 'TagCreator' })
const props = defineProps<TagCreatorProps>()
const emit = defineEmits<TagCreatorEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, handleConfirm, clearInputsValue } = useTagCreator(props)
const { visible, close } = useDialogWrapper(dialogRef)

const formData = computed({
    get: () => ({ name: states.value.name, description: states.value.description }),
    set: (val) => {
        states.value.name = val.name
        states.value.description = val.description
    }
})

// 监听颜色选择器变化
watch(
    () => states.value.color,
    (newVal) => newVal
)

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

const open = () => {
    clearInputsValue()
    visible.value = true
}

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog theme="tag-creator" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建标签</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical>
                <tag-form
                    v-model="formData"
                    :disabled="states.creating"
                    :is-name-empty="states.isNameEmpty"
                />
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
                    <tag-color-selector v-model="states.color" />
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="close">取消</nue-button>
            <nue-button :loading="states.creating" theme="primary" @click="handleSubmit">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--tag-creator {
    min-width: min(20rem, 100vw);
}
</style>

