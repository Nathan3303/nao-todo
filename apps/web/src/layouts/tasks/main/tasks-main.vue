<script setup lang="ts">
import { watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '@/stores/tasks'
import { BasicViewTable, BasicViewKanban } from './basic'
import { ProjectViewTable, ProjectViewKanban } from './project'
import { TagViewTable, TagViewKanban } from './tag'

defineOptions({
    name: 'TasksMain',
    components: {
        'basic-table': BasicViewTable,
        'basic-kanban': BasicViewKanban,
        'project-table': ProjectViewTable,
        'project-kanban': ProjectViewKanban,
        'tag-table': TagViewTable,
        'tag-kanban': TagViewKanban
    }
})

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const componentIs = ref<string | null>(null)

watch(
    () => viewProps.value?.readyState,
    (newReadyState) => {
        // 判断 newReadyState 是否为 2
        if (newReadyState !== 2) return
        // 判断 viewProps 是否存在
        if (!viewProps.value) return
        // 加载组件
        componentIs.value = viewProps.value.category + '-' + viewProps.value.preference.viewType
        // 设置 viewProps.readyState
        viewProps.value.readyState = 3
        // console.log('[TasksMain] Component changed:', componentIs.value, viewProps.value.readyState)
    },
    { immediate: true }
)

watch(
    () => viewProps.value?.preference.viewType,
    (newViewType) => {
        // 判断 viewProps 是否存在
        if (!viewProps.value) return
        // 加载组件
        componentIs.value = viewProps.value.category + '-' + newViewType
        // 设置 viewProps.readyState
        viewProps.value.readyState = 3
        // console.log('[TasksMain] Component changed:', componentIs.value, viewProps.value.readyState)
    }
)
</script>

<template>
    <nue-container v-if="viewProps" id="TasksMainContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <component :is="componentIs" />
            </nue-content>
        </nue-main>
    </nue-container>
</template>
