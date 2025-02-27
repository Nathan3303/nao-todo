import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    CreateProjectDialog,
    CreateTagDialog,
    CreateTodoDialog
} from '@/layers'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import { useTasksViewStore } from './view-store'
import { TagColorSelectDialog } from '@nao-todo/components'
import type { NaoDialogManager } from '@/layouts/dialog-manager'
import type { Tag } from '@nao-todo/types'

export const useTasksDialogStore = defineStore('TasksDialogStore', () => {
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const userStore = useUserStore()
    const tasksViewStore = useTasksViewStore()

    const createProjectDialogRef =
        ref<InstanceType<typeof CreateProjectDialog>>() // 创建清单对话框
    const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>() // 创建待办对话框
    const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>() // 创建标签对话框
    const tagColorSelectDialogRef =
        ref<InstanceType<typeof TagColorSelectDialog>>() // 标签颜色选择对话框
    const dialogManagerRef = ref<InstanceType<typeof NaoDialogManager>>()

    const dialogManagerShow = async (dialogId: string) => {
        if (!dialogManagerRef.value) return
        await dialogManagerRef.value.show(dialogId)
    }

    // 显示创建清单对话框
    const showCreateProjectDialog = () => {
        if (!createProjectDialogRef.value) return
        createProjectDialogRef.value.show()
    }

    // 显示创建待办对话框
    const showCreateTodoDialog = () => {
        if (!createTodoDialogRef.value) return
        if (!tasksViewStore.viewInfo) return
        createTodoDialogRef.value.show({
            userId: userStore.user!.id,
            projects: projectStore.findProjectsFromLocal({
                isDeleted: false,
                isArchived: false
            }),
            tags: tagStore.tags,
            presetInfo: {
                projectId: tasksViewStore.viewInfo.id,
                ...tasksViewStore.viewInfo.createTodoOptions
            }
        })
    }

    // 显示创建标签对话框
    const showCreateTagDialog = () => {
        if (!createTagDialogRef.value) return
        createTagDialogRef.value.show()
    }

    // 显示标签颜色选择对话框
    const showTagColorSelectDialog = async (tagId?: Tag['id'] | PointerEvent) => {
        let _tagId, _tagColor
        if (tagId && typeof tagId === 'string') {
            const tag = tagStore.getTagByIdFromLocal(tagId)
            _tagId = tagId
            _tagColor = tag?.color ?? 'transparent'
        } else {
            if (!tasksViewStore.viewInfo) return
            _tagId = tasksViewStore.viewInfo.id
            _tagColor =
                (tasksViewStore.viewInfo.payload?.color as string) ||
                'transparent'
        }
        console.log(_tagId, _tagColor);
        tagColorSelectDialogRef.value?.show(_tagId, _tagColor)
    }

    return {
        createProjectDialogRef,
        createTodoDialogRef,
        createTagDialogRef,
        tagColorSelectDialogRef,
        dialogManagerRef,
        showCreateProjectDialog,
        showCreateTodoDialog,
        showCreateTagDialog,
        showTagColorSelectDialog,
        dialogManagerShow
    }
})
