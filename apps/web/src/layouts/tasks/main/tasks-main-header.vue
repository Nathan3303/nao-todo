<script setup lang="ts">
import { watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { BasicViewHeader } from './basic'
import { ProjectViewHeader } from './project'
import { TagViewHeader } from './tag'
import { useTasksViewStore } from '@/stores/tasks'

defineOptions({
    name: 'TasksMainHeader',
    components: {
        'basic-header': BasicViewHeader,
        'project-header': ProjectViewHeader,
        'tag-header': TagViewHeader
    }
})

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const componentIs = ref<string | null>(null)

watch(
    () => viewProps.value?.readyState,
    (newReadyState) => {
        // 判断 newReadyState 是否为 1
        if (newReadyState !== 1) return
        // 判断 viewProps 是否存在
        if (!viewProps.value) return
        // 判断 newCategory 是否存在
        if (!viewProps.value.category) return
        // 加载组件
        componentIs.value = viewProps.value.category + '-header'
        // 设置 viewProps.readyState
        viewProps.value.readyState = 2
        // console.log(
        //     '[TasksMainHeader] Component changed:',
        //     componentIs.value,
        //     viewProps.value.readyState
        // )
    },
    { immediate: true }
)
</script>

<template>
    <component v-if="viewProps" :is="componentIs" />
</template>
