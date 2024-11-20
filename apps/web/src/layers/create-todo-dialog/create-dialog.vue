<template>
    <nue-dialog v-model="visible" theme="create-todo" title="创建待办事项">
        <todo-creator
            ref="todoCreatorRef"
            :presetInfo="presetInfo"
            :projects="projects"
            :tags="tags"
            :userId="userId"
        />
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click.stop="confirm">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { TodoCreator } from '@nao-todo/components/todo'
import { NueMessage } from 'nue-ui'
import type { CreateTodoDialogCallerArgs, CreateTodoDialogProps } from './types'
import type { CreateTodoOptions } from '@nao-todo/types'

defineOptions({ name: 'CreateTodoDialog' })
const props = defineProps<CreateTodoDialogProps>()

const visible = ref(false)
const loading = ref(false)
const projects = ref<CreateTodoDialogCallerArgs['projects']>([])
const tags = ref<CreateTodoDialogCallerArgs['tags']>([])
const userId = ref('')
const presetInfo = ref<CreateTodoDialogCallerArgs['presetInfo']>()
const todoCreatorRef = ref<InstanceType<typeof TodoCreator>>()

const confirm = async () => {
    const { handler } = props
    const newTodo = { ...todoCreatorRef.value?.todoData }
    if (!newTodo.name) {
        NueMessage.error('待办事项名称不能为空')
        return
    }
    loading.value = true
    try {
        await handler(newTodo as CreateTodoOptions)
        visible.value = false
    } catch (e) {
        console.warn('[CreateTodoDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

const show = (args: CreateTodoDialogCallerArgs) => {
    // console.log('[CreateDialog/show] args:', args)
    projects.value = args.projects
    tags.value = args.tags
    userId.value = args.userId
    presetInfo.value = args.presetInfo
    visible.value = true
}

defineExpose({
    show
})
</script>

<style>
.nue-dialog--create-todo {
    max-width: 512px;
}
</style>
