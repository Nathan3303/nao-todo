<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO } from '@nao-todo/components/'
import useProjectDragger from '@/layouts/tasks/aside/use-project-dragger'

defineOptions({ name: 'ProjectSmartList' })
withDefaults(defineProps<{ links: NaoSmartListLinkVO[]; draggable?: boolean }>(), {
    draggable: false
})
const emit = defineEmits<{
    (e: 'open-project-manager'): void
    (e: 'open-project-creator'): void
    (e: 'resort', originalId: string, boundId: string, isBefore: boolean): void
}>()

const { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop } =
    useProjectDragger((dragged, dropped, isUp) => {
        const originalId = dragged.dataset.dragId
        const boundId = dropped.dataset.dragId
        if (!originalId || !boundId) return
        emit('resort', originalId, boundId, isUp)
    })
</script>

<template>
    <nao-smart-list
        collapse-item-name="projects"
        name="清单"
        manage-btn-tooltip="管理所有清单"
        create-btn-tooltip="创建新的清单"
        empty-text="用清单来分类收集、组织和管理你的待办任务"
        :draggable="draggable"
        :links="links"
        @manage="() => emit('open-project-manager')"
        @create="() => emit('open-project-creator')"
        @dragstart="handleDragStart"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @dragend="handleDragEnd"
        @drop="handleDrop"
    />
</template>

