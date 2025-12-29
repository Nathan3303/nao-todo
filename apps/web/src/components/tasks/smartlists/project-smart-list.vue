<script lang="ts" setup>
// import useTasksViewStore from '@/views/tasks/tasks-view-store'
// import useTasksDialogStore from '@/views/tasks/tasks-dialog-store'
// import { computed } from 'vue'
import { NaoSmartList, type NaoSmartListLinkVO } from '@/components/ui'

defineOptions({ name: 'ProjectSmartList' })
defineProps<{
    links: NaoSmartListLinkVO[]
}>()
const emit = defineEmits<{
    (e: 'open-project-manager'): void
    (e: 'open-project-creator'): void
}>()

// const tasksViewStore = useTasksViewStore()
// const tasksDialogStore = useTasksDialogStore()

// const links = computed<NaoSmartListLinkVO[]>(() => {
//     return tasksViewStore.projectApp.projects.map((project) => {
//         return {
//             id: project.id,
//             title: project.name,
//             route: { name: 'tasks-project', params: { projectId: project.id } },
//             icon: 'more2'
//         } as NaoSmartListLinkVO
//     })
// })
</script>

<template>
    <nao-smart-list
        collapse-item-name="projects"
        name="清单"
        manage-btn-tooltip="管理所有清单"
        create-btn-tooltip="创建新的清单"
        empty-text="用清单来分类收集、组织和管理你的待办任务"
        :links="links"
        @manage="() => emit('open-project-manager')"
        @create="() => emit('open-project-creator')"
    />
</template>
