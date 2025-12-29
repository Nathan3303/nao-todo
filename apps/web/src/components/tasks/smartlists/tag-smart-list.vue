<script lang="ts" setup>
// import { computed } from 'vue'
import { NaoSmartList, type NaoSmartListLinkVO } from '@/components/ui'
import { TagColorDot } from '@nao-todo/components'
// import useTasksViewStore from '@/views/tasks/tasks-view-store'
// import useTasksDialogStore from '@/views/tasks/tasks-dialog-store'

defineOptions({ name: 'TagSmartList' })
defineProps<{
    links: NaoSmartListLinkVO[]
}>()
const emit = defineEmits<{
    (e: 'open-tag-manager'): void
    (e: 'open-tag-creator'): void
}>()

// const tasksViewStore = useTasksViewStore()
// const tasksDialogStore = useTasksDialogStore()

// const links = computed<NaoSmartListLinkVO[]>(() => {
//     return tasksViewStore.tagApp.tags.map((tag) => {
//         return {
//             id: tag.id,
//             title: tag.name,
//             route: { name: 'tasks-tag', params: { tagId: tag.id } },
//             icon: 'tag',
//             payload: { color: tag.color }
//         } as NaoSmartListLinkVO
//     })
// })
</script>

<template>
    <nao-smart-list
        collapse-item-name="tags"
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
        :links="links"
        @manage="() => emit('open-tag-manager')"
        @create="() => emit('open-tag-creator')"
    >
        <template #linkAppend="{ link }">
            <tag-color-dot :color="link.payload?.color" size="small" />
        </template>
    </nao-smart-list>
</template>
