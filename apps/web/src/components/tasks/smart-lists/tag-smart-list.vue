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
import { NaoSmartList, type NaoSmartListLinkVO, NaoColorDot } from '@/components/ui'
import { useTasksDataStore, useTasksDialogStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
defineOptions({ name: 'TagSmartList' })

const tasksDialogStore = useTasksDialogStore()
const tasksDataStore = useTasksDataStore()

const { tagSmartListData: tags } = storeToRefs(tasksDataStore)

const links = computed<NaoSmartListLinkVO[]>(() => {
    return tags.value.map((tag) => {
        return {
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { id: tag.id } },
            icon: 'tag',
            payload: { color: tag.color }
        } as NaoSmartListLinkVO
    })
})

const handleManage = () => {
    tasksDialogStore.tagManager?.open()
}

const handleCreate = () => {
    tasksDialogStore.tagCreator?.open()
}
</script>
