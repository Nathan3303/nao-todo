<template>
    <nue-dialog theme="create-todo" v-model="visible" title="创建待办事项">
        <todo-creator
            :presetInfo="presetInfo"
            :projects="projects"
            :userId="userId"
            :tags="tags"
            ref="todoCreatorRef"
        />
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button theme="primary" :loading="loading" @click.stop="confirm">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TodoCreator } from '@nao-todo/components/todo'
import { NueMessage } from 'nue-ui'
import type { TodoCreateDialogProps, TodoCreateDialogEmits, TodoCreateDialogArgs } from './types'

defineOptions({ name: 'CreateTodoDialog' })
const props = defineProps<TodoCreateDialogProps>()
defineEmits<TodoCreateDialogEmits>()

const visible = ref(false)
const loading = ref(false)
const projects = ref<TodoCreateDialogArgs['projects']>([])
const tags = ref<TodoCreateDialogArgs['tags']>([])
const userId = ref('')
const presetInfo = ref<TodoCreateDialogArgs['presetInfo']>()
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
        await handler(newTodo)
        visible.value = false
    } catch (e) {
        console.warn('[CreateTodoDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

const show = (args: TodoCreateDialogArgs) => {
    console.log("[CreateDialog/show] args:", args)
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
