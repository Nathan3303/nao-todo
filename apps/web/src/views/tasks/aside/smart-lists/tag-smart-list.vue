<template>
    <nao-smart-list
        collapse-item-name="tags"
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
        :links="links"
        @manage="handleManage"
        @create="handleCreate"
    >
        <template #linkAppend="{ link }">
            <nao-color-dot :color="link.payload?.color" size="sm" />
        </template>
    </nao-smart-list>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useTagStore } from '@/stores'
import { useTasksDialogStore, useTasksHandlerStore } from '../../stores'
import { NaoSmartList, type NaoSmartListLinkVO, NaoColorDot } from '@/components/ui'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagSmartList' })

const tagStore = useTagStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const tags = computed<Tag[]>(() => tagStore.findTagsFromLocal({}) || [])

const links = computed<NaoSmartListLinkVO[]>(() => {
    return tags.value.map((tag) => {
        return {
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { tagId: tag.id } },
            icon: 'tag',
            payload: { color: tag.color }
        } as NaoSmartListLinkVO
    })
})

const handleManage = () => {
    tasksDialogStore.dialogManagerShow('TagManager', { dialogSize: 'large' })
}

const handleCreate = () => {
    tasksDialogStore.dialogManagerShow('TagCreator', {
        confirmHandler: tasksHandlerStore.handleCreateTag,
        dialogSize: 'small'
    })
}
</script>
