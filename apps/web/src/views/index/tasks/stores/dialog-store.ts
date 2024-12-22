import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    CreateProjectDialog,
    CreateTagDialog,
    CreateTodoDialog,
    ProjectManager,
    TagManager
} from '@/layers'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import { useTasksViewStore } from './view-store'
import { TagColorSelectDialog } from '@nao-todo/components'

export const useTasksDialogStore = defineStore('TasksDialogStore', () => {
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const userStore = useUserStore()
    const tasksViewStore = useTasksViewStore()

    // 创建清单对话框
    const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()

    // 创建待办对话框
    const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()

    // 创建标签对话框
    const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()

    // 标签颜色选择对话框
    const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()

    // 清单管理对话框
    const projectManagerRef = ref<InstanceType<typeof ProjectManager>>()

    // 标签管理对话框
    const tagManagerRef = ref<InstanceType<typeof TagManager>>()

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
    const showTagColorSelectDialog = async () => {
        if (!tasksViewStore.viewInfo) return
        tagColorSelectDialogRef.value?.show(
            tasksViewStore.viewInfo.id,
            (tasksViewStore.viewInfo.payload?.color as string) || 'transparent'
        )
    }

    // 显示清单管理对话框
    const showProjectManagerDialog = () => {
        if (!projectManagerRef.value) return
        projectManagerRef.value.show()
    }

    // 显示标签管理对话框
    const showTagManagerDialog = () => {
        if (!tagManagerRef.value) return
        tagManagerRef.value.show()
    }

    return {
        createProjectDialogRef,
        createTodoDialogRef,
        createTagDialogRef,
        tagColorSelectDialogRef,
        projectManagerRef,
        tagManagerRef,
        showCreateProjectDialog,
        showCreateTodoDialog,
        showCreateTagDialog,
        showTagColorSelectDialog,
        showProjectManagerDialog,
        showTagManagerDialog
    }
})