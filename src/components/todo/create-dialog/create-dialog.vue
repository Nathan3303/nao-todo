<template>
    <nue-dialog v-model="visible" title="创建待办事项">
        <todo-creator :projects="projects" :userId="userId" :tags="tags" ref="todoCreatorRef" />
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button theme="primary" :loading="loading" @click.stop="confirm">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TodoCreator from '../creator/creator.vue'
import type { TodoCreateDialogProps, TodoCreateDialogEmits, TodoCreateDialogArgs } from './types'

defineOptions({ name: 'TodoCreateDialog' })
const props = defineProps<TodoCreateDialogProps>()
const emit = defineEmits<TodoCreateDialogEmits>()

const visible = ref(false)
const loading = ref(false)
const projects = ref<TodoCreateDialogArgs['projects']>([])
const tags = ref<TodoCreateDialogArgs['tags']>([])
const userId = ref('')
const todoCreatorRef = ref<InstanceType<typeof TodoCreator>>()

const confirm = async () => {
    const { handler } = props
    const newTodo = { ...todoCreatorRef.value?.todoData }
    loading.value = true
    await handler(newTodo)
    loading.value = false
    visible.value = false
}

const show = (args: TodoCreateDialogArgs) => {
    projects.value = args.projects
    tags.value = args.tags
    userId.value = args.userId
    visible.value = true
}

defineExpose({
    show
})
</script>

<style scoped></style>
