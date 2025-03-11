import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTagStore } from '@/stores'
import { useTasksViewStore } from './view-store'
import { TagColorSelectDialog } from '@nao-todo/components'
import { TasksDialogLoader } from '../components'
import type { Tag } from '@nao-todo/types'
import type { DialogPayload } from '../components/dialogs/types'

export const useTasksDialogStore = defineStore('TasksDialogStore', () => {
    const tagStore = useTagStore()
    const tasksViewStore = useTasksViewStore()

    const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>() // 标签颜色选择对话框
    const dialogManagerRef = ref<InstanceType<typeof TasksDialogLoader>>()

    const dialogManagerShow = async (dialogId: string, dialogPayload?: DialogPayload) => {
        if (!dialogManagerRef.value) return
        await dialogManagerRef.value.show(dialogId, dialogPayload)
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
            _tagColor = (tasksViewStore.viewInfo.payload?.color as string) || 'transparent'
        }
        console.log(_tagId, _tagColor)
        tagColorSelectDialogRef.value?.show(_tagId, _tagColor)
    }

    return {
        tagColorSelectDialogRef,
        dialogManagerRef,
        showTagColorSelectDialog,
        dialogManagerShow
    }
})
