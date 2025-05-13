<template>
    <nue-div vertical>
        <todo-creator-ui
            ref="todoCreatorRef"
            :presetInfo="presetInfo"
            :projects="projects"
            :tags="tags"
            :userId="userStore.user?.id ?? ''"
        />
        <nue-div align="center" justify="end" style="margin-top: auto">
            <nue-button @click="emit('closeDialog')">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click="handleClick">创建</nue-button>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { TodoCreatorUi } from '@nao-todo/components/todo'
import { NueMessage } from 'nue-ui'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import type { TodoCreatorProps } from '@nao-todo/components/todo/creator/types'
import type { CreateTodoOptions } from '@nao-todo/types'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TodoCreator' })
const props = defineProps<{
    handler: (options: CreateTodoOptions) => Promise<boolean>
    presetInfo?: TodoCreatorProps['presetInfo']
}>()
const emit = defineEmits<{ (e: 'closeDialog'): void }>()

const projectStore = useProjectStore()
const tagStore = useTagStore()
const userStore = useUserStore()

const { smartListData: projects } = storeToRefs(projectStore)
const { smartListData: tags } = storeToRefs(tagStore)

const loading = ref(false)
const todoCreatorRef = ref<InstanceType<typeof TodoCreatorUi>>()

const handleClick = async () => {
    const newTodo = { ...todoCreatorRef.value?.todoData }
    if (!newTodo.name) {
        NueMessage.error('待办事项名称不能为空')
        return
    }
    try {
        loading.value = true
        const result = await props.handler(newTodo as CreateTodoOptions)
        if (result) {
            emit('closeDialog')
            todoCreatorRef.value?.clear()
        }
    } catch (e) {
        console.warn('[CreateTodoDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}
</script>
